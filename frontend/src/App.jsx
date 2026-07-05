import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

const customIcon = new L.Icon({ iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });

const SaplingIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22V12" /><path d="M12 12C12 12 15 7 19 7C19 11 12 12 12 12Z" /><path d="M12 16C12 16 9 12 5 12C5 16 12 16 12 16Z" />
  </svg>
);

// Role access pins — must match backend ROLE_PINS exactly.
const ROLE_PINS = {
  Official: 'OFFICIAL1234',
  Moderator: 'MOD1234',
  Admin: 'ADMIN1234'
};

// Backend URL — reads from Vite environment variable when deployed (set VITE_API_URL on Vercel),
// falls back to localhost for local development.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [currentUser, setCurrentUser] = useState(null);
  const [issues, setIssues] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [uiSettings, setUiSettings] = useState({ showBlogs: true, showEvents: true });
  const [blogs, setBlogs] = useState([]);
  const [events, setEvents] = useState([]);

  const [showNotif, setShowNotif] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin');

  // Signup-specific state (role + conditional pin)
  const [signupRole, setSignupRole] = useState('Citizen');
  const [signupPin, setSignupPin] = useState('');
  const [signupError, setSignupError] = useState('');

  // Modals for Roles
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('civicRootsUser');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    const savedTheme = localStorage.getItem('civicRootsTheme') || 'dark';
    setTheme(savedTheme); document.documentElement.setAttribute('data-theme', savedTheme);
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const resIssues = await fetch(`${API_URL}/api/issues`);
      setIssues(await resIssues.json());
      const resNotif = await fetch(`${API_URL}/api/notifications`);
      setNotifications(await resNotif.json());
      const resSettings = await fetch(`${API_URL}/api/settings`);
      setUiSettings(await resSettings.json());
      const resBlogs = await fetch(`${API_URL}/api/blogs`);
      setBlogs(await resBlogs.json());
      const resEvents = await fetch(`${API_URL}/api/events`);
      setEvents(await resEvents.json());
    } catch (e) {}
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme); document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleAuthSubmit = async (e, mode) => {
    e.preventDefault();
    setSignupError('');
    const email = e.target.elements[mode === 'signup' ? 1 : 0].value;
    const password = e.target.elements[mode === 'signup' ? 2 : 1].value;
    const name = mode === 'signup' ? e.target.elements[0].value : undefined;
    const endpoint = mode === 'signup' ? `${API_URL}/api/signup` : `${API_URL}/api/signin`;

    const body = mode === 'signup'
      ? { name, email, password, role: signupRole, pin: signupRole === 'Citizen' ? undefined : signupPin }
      : { email, password };

    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (response.ok) {
        setCurrentUser(data.user); localStorage.setItem('civicRootsUser', JSON.stringify(data.user)); setShowAuthModal(false);
        setSignupRole('Citizen'); setSignupPin(''); setSignupError('');
      } else { setSignupError(data.message); }
    } catch (error) { setSignupError('Connection error.'); }
  };

  const handleRoleUpgrade = async (e) => {
    e.preventDefault();
    const key = e.target.elements[0].value;
    try {
      const res = await fetch(`${API_URL}/api/upgrade-role`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: currentUser.email, key }) });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user); localStorage.setItem('civicRootsUser', JSON.stringify(data.user));
        alert(`Access Granted: You are now a ${data.user.role}`); setShowKeyModal(false);
      } else alert(data.message);
    } catch (e) { alert("Error upgrading role."); }
  };

  const updateUISetting = async (key, value) => {
    await fetch(`${API_URL}/api/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [key]: value }) });
    fetchData();
  };

  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="logo" onClick={() => setCurrentPage('home')}><SaplingIcon /> CIVICCONNECT</div>
        <div className="nav-links">
          <button className="theme-toggle" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>

          {currentUser ? (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>

              {/* Role Badges & Actions */}
              <span style={{ fontSize: '0.8rem', color: 'var(--primary-green)', fontWeight: 'bold' }}>{currentUser.role}</span>
              {currentUser.role === 'Citizen' && <button className="btn-outline btn-small" onClick={() => setShowKeyModal(true)}>Upgrade Role</button>}
              {(currentUser.role === 'Official' || currentUser.role === 'Moderator' || currentUser.role === 'Admin') && (
                <button className="btn-outline btn-small" style={{ borderColor: '#3b82f6', color: '#3b82f6' }} onClick={() => setShowBroadcastModal(true)}>Broadcast Alert</button>
              )}
              {currentUser.role === 'Admin' && (
                <button className="btn-outline btn-small" style={{ borderColor: '#ef4444', color: '#ef4444' }} onClick={() => setShowAdminPanel(true)}>Admin Panel</button>
              )}

              {/* Live Notifications Bell */}
              <div style={{ position: 'relative' }}>
                <button className="bell-icon" onClick={() => setShowNotif(!showNotif)}>
                  🔔 {notifications.length > 0 && <span className="bell-badge">{notifications.length}</span>}
                </button>
                {showNotif && (
                  <div style={{ position: 'absolute', top: '45px', right: '0', width: '300px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>Live Alerts</h4>
                    {notifications.length === 0 ? <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No new alerts.</p> :
                      notifications.map((n, i) => (
                        <div key={i} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '8px' }}>
                          <strong style={{ fontSize: '0.8rem', color: n.type === 'alert' ? '#f59e0b' : '#3b82f6' }}>{n.title}</strong>
                          <p style={{ fontSize: '0.8rem', margin: '2px 0 0 0' }}>{n.message}</p>
                          <small style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{new Date(n.createdAt).toLocaleTimeString()}</small>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>

              <div className="profile-avatar" onClick={() => setCurrentPage('profile')} title="Command Center">{currentUser.name.charAt(0).toUpperCase()}</div>
            </div>
          ) : (
            <>
              <button className="btn-primary" onClick={() => { setShowAuthModal(true); setAuthMode('signin'); setSignupError(''); }}>Sign In</button>
              <button className="btn-primary" onClick={() => { setShowAuthModal(true); setAuthMode('signup'); setSignupError(''); setSignupRole('Citizen'); setSignupPin(''); }}>Sign Up</button>
            </>
          )}
        </div>
      </nav>

      {currentPage === 'home' && <HomeView currentUser={currentUser} issues={issues} setCurrentPage={setCurrentPage} fetchData={fetchData} setShowAuthModal={setShowAuthModal} uiSettings={uiSettings} blogs={blogs} events={events} />}
      {currentPage === 'report' && <ReportIssuePage currentUser={currentUser} existingIssues={issues} fetchData={fetchData} setCurrentPage={setCurrentPage} />}
      {currentPage === 'profile' && <ProfileDashboardPage currentUser={currentUser} issues={issues} setCurrentPage={setCurrentPage} handleLogout={() => {setCurrentUser(null); setCurrentPage('home'); localStorage.removeItem('civicRootsUser');}} />}

      {/* --- MODALS --- */}
      {/* Auth */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAuthModal(false)}>×</button>
            <h2>{authMode === 'signin' ? 'Welcome Back' : 'Create an Account'}</h2>
            <form className="auth-form" onSubmit={(e) => handleAuthSubmit(e, authMode)}>
              {authMode === 'signup' && <input type="text" placeholder="Full Name" required />}
              <input type="email" placeholder="Email Address" required />
              <input type="password" placeholder="Password" required />

              {authMode === 'signup' && (
                <>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Select Role</label>
                  <select
                    required
                    value={signupRole}
                    onChange={(e) => { setSignupRole(e.target.value); setSignupPin(''); setSignupError(''); }}
                    style={{ marginBottom: '10px' }}
                  >
                    <option value="Citizen">Citizen</option>
                    <option value="Official">Official</option>
                    <option value="Moderator">Moderator</option>
                    <option value="Admin">Admin</option>
                  </select>

                  {signupRole !== 'Citizen' && (
                    <input
                      type="password"
                      placeholder={`${signupRole} Access Pin`}
                      required
                      value={signupPin}
                      onChange={(e) => setSignupPin(e.target.value)}
                    />
                  )}
                </>
              )}

              {signupError && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0 0 10px 0' }}>{signupError}</p>}

              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>{authMode === 'signin' ? 'Sign In' : 'Sign Up'}</button>
            </form>
          </div>
        </div>
      )}

      {/* Role Upgrade */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowKeyModal(false)}>×</button>
            <h2>Role Authorization</h2>
            <p>Enter your authorization key to access Official, Moderator, or Admin tools.</p>
            <form className="auth-form" onSubmit={handleRoleUpgrade}>
              <input type="text" placeholder="Access Key" required />
              <button type="submit" className="btn-primary">Authenticate</button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {showAdminPanel && (
        <div className="modal-overlay" onClick={() => setShowAdminPanel(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAdminPanel(false)}>×</button>
            <h2 style={{ color: '#ef4444' }}>Admin Control Panel</h2>
            <p>Modify global UI settings instantly.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Campus Events UI Module</strong>
                <button className="btn-outline btn-small" onClick={() => updateUISetting('showEvents', !uiSettings.showEvents)}>
                  {uiSettings.showEvents ? "Disable Module" : "Enable Module"}
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Campus Blogs UI Module</strong>
                <button className="btn-outline btn-small" onClick={() => updateUISetting('showBlogs', !uiSettings.showBlogs)}>
                  {uiSettings.showBlogs ? "Disable Module" : "Enable Module"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Alerts (Officials, Moderators & Admins — everyone except Citizens) */}
      {showBroadcastModal && (
        <div className="modal-overlay" onClick={() => setShowBroadcastModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowBroadcastModal(false)}>×</button>
            <h2 style={{ color: '#3b82f6' }}>Broadcast Alert</h2>
            <p>Send a live notification to all users on the platform.</p>
            <form className="auth-form" onSubmit={async (e) => {
              e.preventDefault();
              await fetch(`${API_URL}/api/notifications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: "Official Alert", message: e.target.elements[0].value, type: 'alert' }) });
              fetchData(); setShowBroadcastModal(false); alert("Alert Broadcasted!");
            }}>
              <textarea placeholder="Alert Message..." required rows={3}></textarea>
              <button type="submit" className="btn-primary" style={{ background: '#3b82f6' }}>Send Push Notification</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 1. HOME VIEW
// ==========================================
const HomeView = ({ currentUser, issues, setCurrentPage, fetchData, setShowAuthModal, uiSettings, blogs, events }) => {
  const [showIssuesList, setShowIssuesList] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showVolModal, setShowVolModal] = useState(false);
  const [showEventRegModal, setShowEventRegModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [showBlogModal, setShowBlogModal] = useState(null);
  const [messages, setMessages] = useState([]);

  // Admin-only creation modals for Blogs & Events
  const [showNewBlogModal, setShowNewBlogModal] = useState(false);
  const [showNewEventModal, setShowNewEventModal] = useState(false);

  useEffect(() => { if (showChatModal) fetchMessages(); }, [showChatModal]);
  const fetchMessages = async () => { const res = await fetch(`${API_URL}/api/messages`); setMessages(await res.json()); };

  // RBAC Checks
  const canInteract = currentUser && currentUser.role !== 'Visitor';
  const isOfficialOrHigher = currentUser?.role === 'Official' || currentUser?.role === 'Admin' || currentUser?.role === 'Moderator';
  const isModerator = currentUser?.role === 'Moderator';
  const isAdminUser = currentUser?.role === 'Admin';
  const canDeleteChat = isModerator || isAdminUser;

  const handleUpvote = async (id) => {
    if (!canInteract) return alert("Citizens only. Please sign in.");
    await fetch(`${API_URL}/api/issues/${id}/upvote`, { method: 'PUT' }); fetchData();
  };

  const handleUpdateStatus = async (id, status) => {
    await fetch(`${API_URL}/api/issues/${id}/status`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ status, updatedBy: currentUser.name }) });
    fetchData(); alert("Status Updated!");
  };

  // Delete rule: Admin can remove any issue, resolved or not.
  // Moderator can remove ONLY issues marked Resolved.
  // Citizens can still remove their own unassigned ("Reported") reports, as before.
  const canRemoveIssue = (issue) => {
    if (isAdminUser) return true;
    if (isModerator) return issue.status === 'Resolved';
    return currentUser?.name === issue.reportedBy && issue.status === 'Reported';
  };

  const handleDeleteIssue = async (issue) => {
    const confirmMsg = isAdminUser
      ? "Admin Override: Delete this issue permanently?"
      : isModerator
        ? "Moderator Action: Remove this Resolved issue?"
        : "Delete your report?";
    if (window.confirm(confirmMsg)) {
      const res = await fetch(`${API_URL}/api/issues/${issue._id}?role=${currentUser.role}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) { fetchData(); } else { alert(data.message || "Not authorized."); }
    }
  };

  const handleDeleteBlog = async (id) => {
    if (window.confirm("Remove this blog post?")) {
      const res = await fetch(`${API_URL}/api/blogs/${id}?role=${currentUser.role}`, { method: 'DELETE' });
      if (res.ok) { fetchData(); setShowBlogModal(null); } else { alert("Not authorized."); }
    }
  };

  const handleDeleteEvent = async (id) => {
    if (window.confirm("Remove this event?")) {
      const res = await fetch(`${API_URL}/api/events/${id}?role=${currentUser.role}`, { method: 'DELETE' });
      if (res.ok) { fetchData(); } else { alert("Not authorized."); }
    }
  };

  const renderLeaves = () => Array.from({ length: 15 }).map((_, i) => (
    <div key={i} className="leaf" style={{ left: `${Math.random() * 100}%`, animationDuration: `${10 + Math.random() * 15}s`, animationDelay: `${Math.random() * 5}s` }}></div>
  ));

  return (
    <>
      <section className="hero-section">
        <div className="leaves-container">{renderLeaves()}</div>
        <div className="hero-content">
          <h1>Empower your campus.<br/><span>Elevate NIT Jamshedpur.</span></h1>
          <p>Report issues, track lifecycles, discuss locally, and volunteer.</p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={() => canInteract ? setCurrentPage('report') : setShowAuthModal(true)}>
              {canInteract ? "Report an Issue" : "Sign In to Report"}
            </button>
            <button className="btn-outline" onClick={() => {fetchData(); setShowMapModal(true);}}>Explore Campus Map</button>
            <button className="btn-outline" style={{ borderColor: '#3b82f6', color: '#3b82f6' }} onClick={() => setShowChatModal(true)}>Live Discussions</button>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-grid">
          <div className="feature-card" onClick={() => canInteract ? setCurrentPage('report') : setShowAuthModal(true)}>
            <span style={{ color: 'var(--primary-green)', fontSize: '1.5rem' }}>⚠</span>
            <h3>Smart Reporting</h3>
            <p>Upload photos and let our AI classify the issue and track its lifecycle.</p>
          </div>
          <div className="feature-card" onClick={() => setShowIssuesList(true)}>
            <span style={{ color: '#3b82f6', fontSize: '1.5rem' }}>👥</span>
            <h3>Issue Directory</h3>
            <p>Browse all reported issues, upvote critical ones, and track resolutions.</p>
          </div>
          <div className="feature-card" onClick={() => setShowVolModal(true)}>
            <span style={{ color: '#eab308', fontSize: '1.5rem' }}>📅</span>
            <h3>Issue Resolution Portal</h3>
            <p>Claim an issue, post a resolution photo, and earn community reputation.</p>
          </div>
        </div>
      </section>

      {/* Admin Controlled Hub Section */}
      {(uiSettings.showEvents || uiSettings.showBlogs) && (
        <section className="hub-section">
          <div className="hub-grid">

            {uiSettings.showEvents && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '2rem', margin: 0 }}>Campus <span>Events.</span></h2>
                  {isAdminUser && <button className="btn-outline btn-small" onClick={() => setShowNewEventModal(true)}>+ Add Event</button>}
                </div>

                {events.length === 0 ? (
                  <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No events posted yet.
                  </div>
                ) : events.map(ev => (
                  <div key={ev._id} style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <h3 style={{ margin: '0 0 5px 0' }}>{ev.title}</h3>
                      <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', padding: '5px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>{ev.status}</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '10px' }}>📍 {ev.location} • 📅 {ev.dateLabel}</p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn-outline btn-small" onClick={() => { setSelectedEvent(ev.title); setShowEventRegModal(true); }}>Register Event</button>
                      {isAdminUser && <button className="btn-outline btn-small" style={{ borderColor: 'red', color: 'red' }} onClick={() => handleDeleteEvent(ev._id)}>Remove</button>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uiSettings.showBlogs && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '2rem', margin: 0 }}>Latest <span>Blogs.</span></h2>
                  {isAdminUser && <button className="btn-outline btn-small" onClick={() => setShowNewBlogModal(true)}>+ Add Blog</button>}
                </div>

                {blogs.length === 0 ? (
                  <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No blog posts yet.
                  </div>
                ) : blogs.map(b => (
                  <div key={b._id} style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', cursor: 'pointer', marginBottom: '1rem' }} onClick={() => setShowBlogModal(b)}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--primary-green)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{b.tag || "Article"}</div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1.2rem' }}>{b.title}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Click to read full article...</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>
      )}

      <footer className="site-footer"><p>© 2026 CivicConnect. Built for NIT Jamshedpur Campus Management.</p></footer>

      {/* --- MODALS --- */}

      {showEventRegModal && (
        <div className="modal-overlay" onClick={() => setShowEventRegModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowEventRegModal(false)}>×</button>
            <h2>Register for {selectedEvent}</h2>
            <form className="auth-form" onSubmit={(e) => { e.preventDefault(); if(!canInteract) return alert("Citizens only."); alert("Registered Successfully!"); setShowEventRegModal(false); }}>
              <input type="text" placeholder="Full Name" required defaultValue={currentUser?.name || ""} />
              <input type="text" placeholder="Registration/Roll Number" required />
              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>Confirm RSVP</button>
            </form>
          </div>
        </div>
      )}

      {/* Admin: Add New Event */}
      {showNewEventModal && (
        <div className="modal-overlay" onClick={() => setShowNewEventModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowNewEventModal(false)}>×</button>
            <h2>Add New Event</h2>
            <form className="auth-form" onSubmit={async (e) => {
              e.preventDefault();
              const payload = {
                title: e.target.elements[0].value,
                location: e.target.elements[1].value,
                dateLabel: e.target.elements[2].value,
                status: e.target.elements[3].value,
                createdBy: currentUser.name
              };
              const res = await fetch(`${API_URL}/api/events?role=${currentUser.role}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
              if (res.ok) { fetchData(); setShowNewEventModal(false); } else { alert("Not authorized."); }
            }}>
              <input type="text" placeholder="Event Title" required />
              <input type="text" placeholder="Location (e.g. Mega Hostel)" required />
              <input type="text" placeholder="Date/Time Label (e.g. Saturday, 10:00 AM)" required />
              <select required defaultValue="Upcoming">
                <option value="Upcoming">Upcoming</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Closed">Closed</option>
              </select>
              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>Publish Event</button>
            </form>
          </div>
        </div>
      )}

      {/* Admin: Add New Blog */}
      {showNewBlogModal && (
        <div className="modal-overlay" onClick={() => setShowNewBlogModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowNewBlogModal(false)}>×</button>
            <h2>Publish New Blog</h2>
            <form className="auth-form" onSubmit={async (e) => {
              e.preventDefault();
              const payload = {
                title: e.target.elements[0].value,
                tag: e.target.elements[1].value,
                content: e.target.elements[2].value,
                createdBy: currentUser.name
              };
              const res = await fetch(`${API_URL}/api/blogs?role=${currentUser.role}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
              if (res.ok) { fetchData(); setShowNewBlogModal(false); } else { alert("Not authorized."); }
            }}>
              <input type="text" placeholder="Blog Title" required />
              <input type="text" placeholder="Tag (e.g. Community Spotlight)" />
              <textarea placeholder="Blog Content..." required rows={5}></textarea>
              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>Publish Blog</button>
            </form>
          </div>
        </div>
      )}

      {showVolModal && (
        <div className="modal-overlay" onClick={() => setShowVolModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowVolModal(false)}>×</button>
            <h2>Resolution Portal</h2>
            <p>Did you fix an issue? Upload proof to earn 50 Rep Points.</p>
            <form className="auth-form" onSubmit={(e) => { e.preventDefault(); alert("Resolution submitted for review! Points will be added upon verification."); setShowVolModal(false); }}>
              <select required>
                <option value="">Select an Open Issue...</option>
                {issues.filter(i => i.status !== 'Resolved').map(i => (
                  <option key={i._id} value={i._id}>{i.title} - {i.area}</option>
                ))}
              </select>
              <div style={{ background: 'var(--bg-main)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Upload Resolution Photo</label>
                <input type="file" accept="image/*" required style={{ border: 'none', padding: '10px 0 0 0', width: '100%' }} />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '10px' }}>Verify Resolution</button>
            </form>
          </div>
        </div>
      )}

      {showBlogModal && (
        <div className="modal-overlay" onClick={() => setShowBlogModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowBlogModal(null)}>×</button>
            <h2 style={{ color: 'var(--primary-green)' }}>{showBlogModal.title}</h2>
            <p style={{ lineHeight: '1.8', color: 'var(--text-main)', marginTop: '1rem' }}>{showBlogModal.content}</p>
            {isAdminUser && (
              <button className="btn-outline btn-small" style={{ borderColor: 'red', color: 'red', marginTop: '1.5rem' }} onClick={() => handleDeleteBlog(showBlogModal._id)}>Remove Blog</button>
            )}
          </div>
        </div>
      )}

      {/* Issues Directory Modal (With Strict RBAC) */}
      {showIssuesList && (
        <div className="modal-overlay" onClick={() => setShowIssuesList(false)}>
          <div className="modal-content" style={{ maxWidth: '900px', display: 'flex', gap: '1rem' }} onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowIssuesList(false)}>×</button>

            <div style={{ flex: 1, maxHeight: '60vh', overflowY: 'auto', paddingRight: '10px' }}>
              <h2>Issue Directory</h2>
              {issues.map(issue => (
                <div key={issue._id} style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ margin: '0 0 5px 0' }}>{issue.title}</h3>
                  <div style={{ fontSize: '0.8rem', marginBottom: '10px' }}>
                    <span style={{ color: 'var(--primary-green)' }}>{issue.category}</span> •
                    <span style={{ color: '#3b82f6', marginLeft: '5px' }}>{issue.status}</span>
                  </div>
                  <p style={{ fontSize: '0.9rem' }}>{issue.description}</p>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button className="btn-outline btn-small" onClick={() => handleUpvote(issue._id)}>👍 Support ({issue.upvotes || 0})</button>

                    {/* Official Controls (Officials, Mods, Admins) */}
                    {isOfficialOrHigher && (
                      <select onChange={(e) => handleUpdateStatus(issue._id, e.target.value)} style={{ padding: '2px', fontSize: '0.8rem', background: '#3b82f6', color: 'white', borderRadius: '4px' }}>
                        <option value="">Update Status...</option>
                        <option value="Under Review">Under Review</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    )}

                    {/* Delete rule: Admin = always. Moderator = Resolved only. Citizen = own Reported-only report. */}
                    {canRemoveIssue(issue) && (
                      <button className="btn-outline btn-small" style={{ borderColor: 'red', color: 'red' }} onClick={() => handleDeleteIssue(issue)}>Remove Issue</button>
                    )}
                  </div>

                  <details style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <summary style={{ cursor: 'pointer' }}>View Lifecycle History</summary>
                    <ul style={{ paddingLeft: '15px', marginTop: '5px' }}>
                      {issue.history?.map((h, i) => <li key={i}>{h.status} by {h.updatedBy}</li>)}
                    </ul>
                  </details>
                </div>
              ))}
            </div>

            <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden' }}>
              <MapContainer center={[22.7765, 86.1437]} zoom={15} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {issues.filter(i => i.lat).map((issue) => (
                  <Marker key={issue._id} position={[issue.lat, issue.lng]} icon={customIcon}>
                    <Popup><strong style={{color:'black'}}>{issue.title}</strong><br/><span style={{color:'black'}}>{issue.status}</span></Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {showMapModal && (
        <div className="modal-overlay" onClick={() => setShowMapModal(false)}>
          <div className="modal-content" style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowMapModal(false)}>×</button>
            <h2>NIT Jamshedpur Map</h2>
            <div style={{ height: '450px', width: '100%', borderRadius: '12px', overflow: 'hidden', marginTop: '1rem' }}>
              <MapContainer center={[22.7765, 86.1437]} zoom={16} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {issues.filter(issue => issue.lat && issue.lng).map((issue) => (
                  <Marker key={issue._id} position={[issue.lat, issue.lng]} icon={customIcon}>
                    <Popup>
                      <div style={{ color: '#0d0f12', minWidth: '180px' }}>
                        <h3 style={{ margin: '0 0 5px 0' }}>{issue.title}</h3>
                        <span style={{ background: '#00d284', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginRight: '5px' }}>{issue.category}</span>
                        <span style={{ background: issue.status === 'Resolved' ? '#00d284' : '#3b82f6', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>Lifecycle: {issue.status}</span>
                        <p style={{ margin: '5px 0' }}>{issue.description}</p>
                        {issue.image && <img src={issue.image} alt="Issue" style={{ width: '100%', borderRadius: '4px', marginTop: '5px' }} />}
                        <button className="btn-primary btn-small" style={{ width: '100%', marginTop: '10px' }} onClick={() => handleUpvote(issue._id)}>
                          👍 Support Issue ({issue.upvotes || 0})
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Community Discussions */}
      {showChatModal && (
        <div className="modal-overlay" onClick={() => setShowChatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowChatModal(false)}>×</button>
            <h2>Neighborhood Forum</h2>
            <div style={{ height: '400px', overflowY: 'auto', background: 'var(--bg-main)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem' }}>
              {messages.map(msg => (
                <div key={msg._id} style={{ marginBottom: '10px', background: 'var(--bg-card)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--primary-green)' }}>{msg.sender}</strong>
                    {canDeleteChat && <button style={{ fontSize: '0.7rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={async () => { await fetch(`${API_URL}/api/messages/${msg._id}?role=${currentUser.role}`, {method: 'DELETE'}); fetchMessages(); }}>[Delete]</button>}
                  </div>
                  <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>{msg.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if(!canInteract) return alert("Sign in to post.");
              await fetch(`${API_URL}/api/messages`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({text: e.target.elements[0].value, sender: currentUser.name}) });
              e.target.reset(); fetchMessages();
            }} style={{ display: 'flex', gap: '10px' }}>
              <input type="text" required placeholder="Type a message..." style={{ flex: 1, padding: '10px', borderRadius: '20px' }} />
              <button type="submit" className="btn-primary" style={{ padding: '0 20px' }}>Post</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// ==========================================
// 2. REPORT PAGE
// ==========================================
const ReportIssuePage = ({ currentUser, existingIssues, fetchData, setCurrentPage }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [severity, setSeverity] = useState("");
  const [imageBase64, setImageBase64] = useState("");

  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [isAutoClassified, setIsAutoClassified] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeInput = (text) => {
    const lowerText = text.toLowerCase();
    let detectedCategory = category;
    if (lowerText.match(/(pothole|crack|road|pavement|asphalt|traffic)/)) detectedCategory = "Road Damage";
    else if (lowerText.match(/(leak|pipe|water|drain|flood|sewage)/)) detectedCategory = "Water Leaks";
    else if (lowerText.match(/(wire|spark|power|light|pole|electricity)/)) detectedCategory = "Electrical";
    else if (lowerText.match(/(garbage|trash|smell|waste|bin|dump)/)) detectedCategory = "Sanitation Issues";

    if (detectedCategory !== category && detectedCategory !== "") {
      setCategory(detectedCategory);
      setIsAutoClassified(true);
      setTimeout(() => setIsAutoClassified(false), 3000);
    }

    const significantWords = lowerText.split(/[\s,.]+/).filter(w => w.length > 4);
    if (significantWords.length > 1 && existingIssues.length > 0) {
      const match = existingIssues.find(report => {
        const reportText = (report.title + " " + report.description).toLowerCase();
        return significantWords.filter(word => reportText.includes(word)).length >= 2;
      });
      setDuplicateWarning(match || null);
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onloadstart = () => setIsAnalyzing(true);
    reader.onloadend = () => {
      setImageBase64(reader.result);
      setTimeout(() => { setIsAnalyzing(false); analyzeInput(title + " " + description); }, 1500);
    };
    if(file) reader.readAsDataURL(file);
  };

  const getCoordinatesForArea = (areaName) => {
    const locationCoords = {
      "Mega Hostel": { lat: 22.7785, lng: 86.1455 }, "Academic Building": { lat: 22.7758, lng: 86.1435 },
      "Library": { lat: 22.7755, lng: 86.1445 }, "Computer Centre": { lat: 22.7762, lng: 86.1442 },
      "Main Gate": { lat: 22.7735, lng: 86.1425 }, "Sports Ground": { lat: 22.7770, lng: 86.1420 }
    };
    const base = locationCoords[areaName] || { lat: 22.7765, lng: 86.1437 };
    return { lat: base.lat + (Math.random() - 0.5) * 0.001, lng: base.lng + (Math.random() - 0.5) * 0.001 };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const coords = getCoordinatesForArea(area);
    const payload = { title, category, severity, area, description, image: imageBase64, isAnonymous: false, reportedBy: currentUser.name, lat: coords.lat, lng: coords.lng };

    try {
      const res = await fetch(`${API_URL}/api/issues`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { fetchData(); setIsSuccess(true); }
      else { alert("Failed to submit."); }
    } catch (e) { alert("Server error."); }
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
        <h1 style={{ color: 'var(--primary-green)', fontSize: '3rem', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1rem' }}>Target Locked.</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginBottom: '3rem' }}>The municipal grid has been alerted.</p>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={() => setCurrentPage('home')}>Return to Dashboard</button>
          <button className="btn-outline" onClick={() => { setIsSuccess(false); setTitle(""); setDescription(""); setImageBase64(""); }}>Report Another Issue</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '3rem auto', padding: '0 2rem', width: '100%' }}>
      <button onClick={() => setCurrentPage('home')} style={{ background: 'none', border: 'none', color: 'var(--primary-green)', cursor: 'pointer', marginBottom: '2rem', fontWeight: 'bold' }}>&larr; Back to Base</button>

      <h1 style={{ fontSize: '3rem', fontWeight: '300', marginBottom: '2rem' }}>Log Civic <span style={{ color: 'var(--primary-green)', fontWeight: '700' }}>Anomaly.</span></h1>

      <div style={{ background: 'var(--bg-card)', padding: '3rem', borderRadius: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
        {duplicateWarning && (
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>
            <h4 style={{ color: '#f59e0b', margin: '0 0 5px 0' }}>⚠️ System AI: Similar Anomaly Detected</h4>
            <p style={{ fontSize: '0.9rem', margin: '0 0 10px 0' }}>We found a recent report matching your description: "{duplicateWarning.title}"</p>
            <button className="btn-outline btn-small" style={{ borderColor: '#f59e0b', color: '#f59e0b' }} onClick={() => setCurrentPage('home')}>Upvote Existing Report Instead</button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Anomaly Designation</label>
              <input type="text" required value={title} onChange={(e) => { setTitle(e.target.value); analyzeInput(e.target.value); }} style={{ marginTop: '0.5rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                Threat Level {isAutoClassified && <span style={{ color: '#10b981', animation: 'pulse 2s infinite' }}>✨ AI Classified</span>}
              </label>
              <select required value={category} onChange={(e) => setCategory(e.target.value)} style={{ marginTop: '0.5rem', border: isAutoClassified ? '1px solid #10b981' : '' }}>
                <option value="">{isAutoClassified ? "AI Suggests: " + category : "Classify Anomaly..."}</option>
                <option value="Road Damage">Road Damage</option><option value="Water Leaks">Water Leaks</option>
                <option value="Electrical">Electrical</option><option value="Sanitation Issues">Sanitation Issues</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1rem' }}>
            <select required value={severity} onChange={e => setSeverity(e.target.value)}>
              <option value="">Select Severity</option><option value="Low">Low Priority</option><option value="Medium">Medium Priority</option><option value="High">High / Urgent Hazard</option>
            </select>
            <select required value={area} onChange={e => setArea(e.target.value)}>
              <option value="">Select Campus Area</option><option value="Mega Hostel">Mega Hostel</option><option value="Academic Building">Academic Building</option><option value="Library">Library</option><option value="Computer Centre">Computer Centre</option><option value="Sports Ground">Sports Ground</option>
            </select>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tactical Analysis (Description)</label>
            <textarea required rows={4} value={description} onChange={(e) => { setDescription(e.target.value); analyzeInput(e.target.value); }} style={{ marginTop: '0.5rem' }} />
          </div>

          <div style={{ marginTop: '1rem', background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
             <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Visual Evidence (Triggers AI Scan)</label>
             <input type="file" accept="image/*" onChange={handleImageUpload} style={{ border: 'none', padding: '10px 0 0 0', width: '100%' }} />
             {isAnalyzing && <p style={{ color: 'var(--primary-green)', fontSize: '0.9rem', margin: '10px 0 0 0' }}>⏳ Neural Net scanning image...</p>}
             {imageBase64 && !isAnalyzing && (<div style={{ marginTop: '10px' }}><img src={imageBase64} alt="Preview" style={{ width: '150px', borderRadius: '8px' }} /></div>)}
          </div>

          <button type="submit" disabled={isSubmitting || duplicateWarning} className="btn-primary" style={{ marginTop: '2rem', width: '100%', padding: '1rem', fontSize: '1.1rem', letterSpacing: '2px', textTransform: 'uppercase' }}>
            {isSubmitting ? "Transmitting..." : duplicateWarning ? "Please Resolve Duplicate" : "Execute Report Protocol"}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 3. PROFILE DASHBOARD
// ==========================================
const ProfileDashboardPage = ({ currentUser, issues, handleLogout, setCurrentPage }) => {
  const myIssues = issues.filter(i => i.reportedBy === currentUser.name);
  const resolvedCount = myIssues.filter(i => i.status === 'Resolved').length;
  const reputation = (myIssues.length * 15) + (resolvedCount * 50);

  return (
    <div style={{ maxWidth: '1400px', margin: '2rem auto', padding: '0 2rem', width: '100%', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

      <div style={{ flex: '1', minWidth: '280px', maxWidth: '350px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '2.5rem 2rem', borderRadius: '20px', border: '1px solid var(--border-color)', textAlign: 'center', position: 'sticky', top: '100px' }}>
           <div style={{ width: '100px', height: '100px', background: 'var(--primary-green)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '3rem', color: '#fff', fontWeight: '700', margin: '0 auto 1.5rem auto', boxShadow: '0 0 30px rgba(0, 210, 132, 0.4)' }}>
              {currentUser.name.charAt(0).toUpperCase()}
           </div>
           <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem' }}>{currentUser.name}</h2>
           <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>{currentUser.email}</p>

           <div style={{ display: 'inline-block', padding: '4px 12px', background: 'var(--primary-green)', color: '#000', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2rem' }}>
             {currentUser.role || 'Citizen'}
           </div>

           <button className="btn-primary" style={{ width: '100%', marginBottom: '1rem' }} onClick={() => setCurrentPage('home')}>Return to Main Menu</button>
           <button className="btn-outline" style={{ width: '100%', borderColor: '#ff4d4d', color: '#ff4d4d' }} onClick={handleLogout}>Sign Out System</button>
        </div>
      </div>

      <div style={{ flex: '2', minWidth: '400px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '300', margin: '0 0 2rem 0' }}>Command <span style={{ color: 'var(--primary-green)', fontWeight: '700' }}>Center.</span></h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.2rem', marginBottom: '2.5rem' }}>
           <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '2.2rem', margin: '0 0 5px 0', color: 'var(--text-main)' }}>{myIssues.length}</h2>
              <p style={{ margin: '0', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Total Anomalies</p>
           </div>
           <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '2.2rem', margin: '0 0 5px 0', color: '#3b82f6' }}>{resolvedCount}</h2>
              <p style={{ margin: '0', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Resolutions</p>
           </div>
           <div style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <h2 style={{ fontSize: '2.2rem', margin: '0 0 5px 0', color: '#eab308' }}>{reputation}</h2>
              <p style={{ margin: '0', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '1px' }}>Reputation Accrued</p>
           </div>
        </div>

        <h3 style={{ fontSize: '1.2rem', margin: '0 0 1rem 0' }}>My Operational History</h3>
        {myIssues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
            <p style={{ color: 'var(--text-muted)' }}>No operational history found in the database.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {myIssues.map(issue => (
              <div key={issue._id} style={{ background: 'var(--bg-card)', padding: '1.2rem 1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ margin: '0', fontSize: '1.1rem' }}>{issue.title}</h4>
                    <span style={{ background: issue.status === 'Resolved' ? 'rgba(0, 210, 132, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: issue.status === 'Resolved' ? 'var(--primary-green)' : '#3b82f6', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {issue.status}
                    </span>
                  </div>
                  <p style={{ margin: '0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{issue.area} • {issue.category}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(issue.createdAt).toLocaleDateString()}</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-green)' }}>👍 {issue.upvotes || 0}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: '1', minWidth: '300px' }}>
        <h3 style={{ fontSize: '1.2rem', margin: '1rem 0 1rem 0' }}>AI Network Insights</h3>
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: '2rem' }}>
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}><span style={{ color: '#10b981' }}>✨</span><p style={{ margin: '0', fontSize: '0.85rem', lineHeight: '1.5' }}><strong>Trend Detected:</strong> Reports of 'Water Leaks' in Mega Hostel are down 24% this month.</p></div>
          <div style={{ padding: '1.2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}><span style={{ color: '#f59e0b' }}>⚠️</span><p style={{ margin: '0', fontSize: '0.85rem', lineHeight: '1.5' }}><strong>Predictive Alert:</strong> Priority classification for 'Drainage Blockages' activated.</p></div>
          <div style={{ padding: '1.2rem', display: 'flex', gap: '10px' }}><span style={{ color: '#3b82f6' }}>📈</span><p style={{ margin: '0', fontSize: '0.85rem', lineHeight: '1.5' }}><strong>Community Stat:</strong> 15 issues were successfully resolved by campus volunteers this week.</p></div>
        </div>
      </div>

    </div>
  );
};
