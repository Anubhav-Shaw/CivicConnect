const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/civicroots')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB error:', err));

// --- ROLE ACCESS PINS ---
// Citizen needs no pin. Official / Moderator / Admin must supply the matching pin at signup.
const ROLE_PINS = {
  Official: 'OFFICIAL1234',
  Moderator: 'MOD1234',
  Admin: 'ADMIN1234'
};

// --- GLOBAL ADMIN SETTINGS (In-Memory for quick toggling) ---
let uiSettings = { showBlogs: true, showEvents: true };

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
  name: String, email: { type: String, required: true, unique: true }, password: String,
  role: { type: String, default: 'Citizen' },
  points: { type: Number, default: 0 }
}));

const Issue = mongoose.model('Issue', new mongoose.Schema({
  title: String, category: String, severity: String, area: String, description: String,
  image: String, isAnonymous: Boolean, reportedBy: String,
  status: { type: String, default: 'Reported' },
  history: [{ status: String, updatedBy: String, date: { type: Date, default: Date.now } }],
  upvotes: { type: Number, default: 0 },
  lat: Number, lng: Number, createdAt: { type: Date, default: Date.now }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
  text: String, sender: String, image: String, likes: { type: Number, default: 0 }, createdAt: { type: Date, default: Date.now }
}));

const Notification = mongoose.model('Notification', new mongoose.Schema({
  title: String, message: String, type: String, createdAt: { type: Date, default: Date.now }
}));

// Blogs & Events are now database-backed so Admin can manage them from the website itself.
const Blog = mongoose.model('Blog', new mongoose.Schema({
  title: String, content: String, tag: String, createdBy: String, createdAt: { type: Date, default: Date.now }
}));

const EventItem = mongoose.model('EventItem', new mongoose.Schema({
  title: String, location: String, dateLabel: String, status: { type: String, default: 'Upcoming' },
  createdBy: String, createdAt: { type: Date, default: Date.now }
}));

// --- HELPER: role check ---
const isModOrAdmin = (role) => role === 'Moderator' || role === 'Admin';
const isAdmin = (role) => role === 'Admin';

// --- ROUTES ---

// Auth & Roles
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, role, pin } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email registered' });

    const requestedRole = role || 'Citizen';

    // Citizen requires no pin. Official / Moderator / Admin must match the correct pin.
    if (requestedRole !== 'Citizen') {
      const expectedPin = ROLE_PINS[requestedRole];
      if (!expectedPin) return res.status(400).json({ message: 'Invalid role selected' });
      if (pin !== expectedPin) return res.status(403).json({ message: 'Incorrect access pin for selected role' });
    }

    const user = new User({ name, email, password, role: requestedRole });
    await user.save();
    res.status(201).json({ user });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.password !== password) return res.status(401).json({ message: 'Invalid credentials' });
    res.status(200).json({ user });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Role upgrade kept for existing accounts that want to switch roles later, same pin scheme.
app.put('/api/upgrade-role', async (req, res) => {
  try {
    const { email, key } = req.body;
    let newRole = null;
    if (key === ROLE_PINS.Official) newRole = 'Official';
    else if (key === ROLE_PINS.Moderator) newRole = 'Moderator';
    else if (key === ROLE_PINS.Admin) newRole = 'Admin';
    else return res.status(400).json({ message: 'Invalid Key' });

    const user = await User.findOneAndUpdate({ email }, { role: newRole }, { new: true });
    res.json({ user });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// UI Settings
app.get('/api/settings', (req, res) => res.json(uiSettings));
app.put('/api/settings', (req, res) => {
  uiSettings = { ...uiSettings, ...req.body };
  res.json(uiSettings);
});

// Issues
app.get('/api/issues', async (req, res) => res.json(await Issue.find().sort({ createdAt: -1 })));

app.post('/api/issues', async (req, res) => {
  try {
    const issue = new Issue(req.body);
    issue.history.push({ status: 'Reported', updatedBy: req.body.reportedBy });
    await issue.save();
    res.status(201).json(issue);
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

app.put('/api/issues/:id/status', async (req, res) => {
  try {
    const { status, updatedBy } = req.body;
    const issue = await Issue.findById(req.params.id);
    issue.status = status;
    issue.history.push({ status, updatedBy });
    await issue.save();

    if (status === 'Resolved') {
      await new Notification({ title: "Issue Resolved", message: `Official update: ${issue.title} in ${issue.area} is marked as Resolved.`, type: "success" }).save();
    }
    res.json(issue);
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

// Delete rule enforced server-side:
// - Admin: can delete any issue, resolved or not.
// - Moderator: can delete ONLY resolved issues.
// - Citizen: cannot use this route (frontend already restricts, this is the backend guarantee).
app.delete('/api/issues/:id', async (req, res) => {
  try {
    const { role } = req.query; // role passed as query param by frontend
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    if (isAdmin(role)) {
      await Issue.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }

    if (role === 'Moderator') {
      if (issue.status !== 'Resolved') {
        return res.status(403).json({ message: 'Moderators can only remove Resolved issues' });
      }
      await Issue.findByIdAndDelete(req.params.id);
      return res.json({ success: true });
    }

    return res.status(403).json({ message: 'Not authorized to delete this issue' });
  } catch (err) { res.status(500).json({ message: 'Error' }); }
});

app.put('/api/issues/:id/upvote', async (req, res) => {
  res.json(await Issue.findByIdAndUpdate(req.params.id, { $inc: { upvotes: 1 } }, { new: true }));
});

// Messages & Notifications
app.get('/api/messages', async (req, res) => res.json(await Message.find().sort({ createdAt: 1 })));
app.post('/api/messages', async (req, res) => {
  const msg = new Message(req.body); await msg.save(); res.status(201).json(msg);
});

// Only Admin can delete any message; Moderator keeps prior behavior of deleting any message too,
// since chat messages have no "resolved" state to gate on.
app.delete('/api/messages/:id', async (req, res) => {
  const { role } = req.query;
  if (!isModOrAdmin(role)) return res.status(403).json({ message: 'Not authorized' });
  await Message.findByIdAndDelete(req.params.id); res.json({ success: true });
});

app.get('/api/notifications', async (req, res) => res.json(await Notification.find().sort({ createdAt: -1 }).limit(10)));
app.post('/api/notifications', async (req, res) => {
  const notif = new Notification(req.body); await notif.save(); res.status(201).json(notif);
});

// --- BLOGS (Admin can create/delete directly from the website) ---
app.get('/api/blogs', async (req, res) => res.json(await Blog.find().sort({ createdAt: -1 })));

app.post('/api/blogs', async (req, res) => {
  const { role } = req.query;
  if (!isAdmin(role)) return res.status(403).json({ message: 'Only Admin can publish blogs' });
  const blog = new Blog(req.body); await blog.save(); res.status(201).json(blog);
});

app.delete('/api/blogs/:id', async (req, res) => {
  const { role } = req.query;
  if (!isAdmin(role)) return res.status(403).json({ message: 'Only Admin can remove blogs' });
  await Blog.findByIdAndDelete(req.params.id); res.json({ success: true });
});

// --- EVENTS (Admin can create/delete directly from the website) ---
app.get('/api/events', async (req, res) => res.json(await EventItem.find().sort({ createdAt: -1 })));

app.post('/api/events', async (req, res) => {
  const { role } = req.query;
  if (!isAdmin(role)) return res.status(403).json({ message: 'Only Admin can create events' });
  const event = new EventItem(req.body); await event.save(); res.status(201).json(event);
});

app.delete('/api/events/:id', async (req, res) => {
  const { role } = req.query;
  if (!isAdmin(role)) return res.status(403).json({ message: 'Only Admin can remove events' });
  await EventItem.findByIdAndDelete(req.params.id); res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
