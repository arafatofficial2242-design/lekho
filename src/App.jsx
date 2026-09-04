import { useState, useEffect, useRef } from 'react'
import { translations } from './translations'
import { supabase } from './supabaseClient'
import { containsProfanity } from './profanityFilter'
import ProfilePage from './ProfilePage'
import Logo from './Logo'

const POSTS_PER_PAGE = 10
const ADMIN_EMAILS = ['ahariyan173@gmail.com', 'arafatofficial2242@gmail.com']

const CATEGORIES = [
  { key: 'literature', bn: 'সাহিত্য', en: 'Literature & Writing' },
  { key: 'opinion', bn: 'মতামত', en: 'Opinion' },
  { key: 'society', bn: 'সমাজ', en: 'Society' },
  { key: 'religion', bn: 'ধর্ম', en: 'Religion' },
  { key: 'history', bn: 'ইতিহাস', en: 'History' },
  { key: 'bangladesh', bn: 'বাংলাদেশ', en: 'Bangladesh' },
  { key: 'world', bn: 'বিশ্ব', en: 'World' },
  { key: 'geopolitics', bn: 'ভূরাজনীতি', en: 'Geopolitics' },
  { key: 'war', bn: 'যুদ্ধ', en: 'War' },
  { key: 'analysis', bn: 'বিশ্লেষণ', en: 'Analysis' },
  { key: 'science_tech', bn: 'বিজ্ঞান-প্রযুক্তি', en: 'Science & Technology' },
  { key: 'culture', bn: 'সংস্কৃতি', en: 'Culture' },
  { key: 'life', bn: 'জীবন', en: 'Life Experience' },
  { key: 'ideas', bn: 'ভাবনা', en: 'Ideas' },
  { key: 'education', bn: 'শিক্ষা', en: 'Education' },
  { key: 'career', bn: 'ক্যারিয়ার', en: 'Career' },
  { key: 'business', bn: 'ব্যবসা', en: 'Business' },
  { key: 'creativity', bn: 'সৃজনশীলতা', en: 'Creativity' },
  { key: 'self_improvement', bn: 'আত্ম-উন্নয়ন', en: 'Self Improvement' },
  { key: 'mental_growth', bn: 'মানসিক বিকাশ', en: 'Mental Growth' },
  { key: 'others', bn: 'অন্যান্য', en: 'Others' },
]

function categoryLabel(key, lang) {
  const c = CATEGORIES.find(c => c.key === key)
  if (!c) return key
  return lang === 'bn' ? c.bn : c.en
}

const formatNumber = (num) => {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  return num
}

const formatDateTime = (dateStr, lang) => {
  if (!dateStr) return ''
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US'
  return new Date(dateStr).toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const calculateReadingTime = (text, lang) => {
  if (!text) return lang === 'bn' ? '১ মিনিট পাঠ' : '1 min read'
  const words = text.trim().split(/\s+/).filter(Boolean).length
  const minutes = Math.max(1, Math.ceil(words / 180))
  if (lang === 'bn') {
    const bnNums = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
    const bnMin = minutes.toString().split('').map(d => bnNums[d] || d).join('')
    return `${bnMin} মিনিট পাঠ`
  }
  return `${minutes} min read`
}

const playPopSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(580, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  } catch (e) {}
}

function SkeletonPostCard({ colors, isDark }) {
  return (
    <div style={{
      border: `1px solid ${colors.cardBorder}`,
      background: colors.cardBg,
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '14px',
      animation: 'pulse 1.5s infinite ease-in-out',
      textAlign: 'left'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: isDark ? '#2a2b30' : '#e2e8f0' }} />
        <div style={{ width: '120px', height: '14px', borderRadius: '4px', background: isDark ? '#2a2b30' : '#e2e8f0' }} />
      </div>
      <div style={{ width: '60%', height: '16px', borderRadius: '4px', background: isDark ? '#2a2b30' : '#e2e8f0', marginBottom: '8px' }} />
      <div style={{ width: '95%', height: '12px', borderRadius: '4px', background: isDark ? '#2a2b30' : '#e2e8f0', marginBottom: '6px' }} />
      <div style={{ width: '80%', height: '12px', borderRadius: '4px', background: isDark ? '#2a2b30' : '#e2e8f0', marginBottom: '12px' }} />
    </div>
  )
}

function ProfileNoteBox({ profileUserId, session, lang, colors, isDark, showToast }) {
  const [note, setNote] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isMyProfile = session.user.id === profileUserId

  useEffect(() => {
    loadNote()
  }, [profileUserId])

  const loadNote = async () => {
    const { data } = await supabase
      .from('profile_notes')
      .select('*')
      .eq('user_id', profileUserId)
      .maybeSingle()

    if (data) {
      const createdAt = new Date(data.created_at).getTime()
      const now = new Date().getTime()
      const hoursPassed = (now - createdAt) / (1000 * 60 * 60)

      if (hoursPassed > 24) {
        setNote(null)
      } else {
        setNote(data)
      }
    } else {
      setNote(null)
    }
  }

  const handleSaveNote = async (e) => {
    e.preventDefault()
    if (!noteText.trim()) return

    setSubmitting(true)
    const { error } = await supabase
      .from('profile_notes')
      .upsert({
        user_id: session.user.id,
        note: noteText.trim(),
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    setSubmitting(false)
    if (!error) {
      setIsEditing(false)
      setNoteText('')
      loadNote()
      showToast(lang === 'bn' ? '💬 ২৪ ঘণ্টার প্রফাইল নোট আপডেট হয়েছে!' : '💬 24-hour profile note updated!', 'success')
    } else {
      showToast('Error: ' + error.message, 'error')
    }
  }

  return (
    <div style={{ margin: '10px 0', textAlign: 'center' }}>
      {note ? (
        <div style={{
          display: 'inline-block',
          background: colors.inputBg,
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: '16px',
          padding: '6px 14px',
          fontSize: '13.5px',
          color: colors.text,
          position: 'relative',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}>
          💬 "{note.note}"
          {isMyProfile && (
            <button
              onClick={() => { setIsEditing(true); setNoteText(note.note) }}
              style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', fontSize: '11px', marginLeft: '8px' }}
            >
              {lang === 'bn' ? 'এডিট' : 'Edit'}
            </button>
          )}
        </div>
      ) : isMyProfile && !isEditing ? (
        <button
          onClick={() => setIsEditing(true)}
          style={{
            background: 'none',
            border: `1px dashed ${colors.cardBorder}`,
            color: colors.textMuted,
            borderRadius: '16px',
            padding: '4px 12px',
            fontSize: '12.5px',
            cursor: 'pointer'
          }}
        >
          + {lang === 'bn' ? 'একটি ২৪ ঘণ্টার নোট যোগ করুন...' : 'Add a 24h note...'}
        </button>
      ) : null}

      {isEditing && (
        <form onSubmit={handleSaveNote} style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            maxLength={50}
            placeholder={lang === 'bn' ? 'মনোভাব বা নোট লিখুন (সর্বোচ্চ ৫০ অক্ষর)...' : 'Write a note (max 50 chars)...'}
            style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, width: '220px' }}
            required
          />
          <button type="submit" disabled={submitting} style={{ padding: '6px 12px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            {submitting ? '...' : (lang === 'bn' ? 'সেভ' : 'Save')}
          </button>
          <button type="button" onClick={() => setIsEditing(false)} style={{ padding: '6px 8px', background: isDark ? '#444' : '#cbd5e1', color: colors.text, border: 'none', borderRadius: '8px', fontSize: '12px' }}>
            ✕
          </button>
        </form>
      )}
    </div>
  )
}

function NewPostForm({ session, lang, colors, isDark, onPostCreated, showToast }) {
  const [title, setTitle] = useState(localStorage.getItem('lekho_draft_title') || '')
  const [content, setContent] = useState(localStorage.getItem('lekho_draft_content') || '')
  const [category, setCategory] = useState(CATEGORIES[0].key)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    localStorage.setItem('lekho_draft_title', title)
  }, [title])

  useEffect(() => {
    localStorage.setItem('lekho_draft_content', content)
  }, [content])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return

    if (containsProfanity(content) || containsProfanity(title)) {
      showToast(translations[lang].profanityPost, 'error')
      return
    }

    setPosting(true)

    const { error } = await supabase.from('posts').insert({
      author_id: session.user.id,
      title: title,
      content: content,
      category: category
    })

    setPosting(false)

    if (error) {
      showToast('Error: ' + error.message, 'error')
    } else {
      setTitle('')
      setContent('')
      localStorage.removeItem('lekho_draft_title')
      localStorage.removeItem('lekho_draft_content')
      showToast(lang === 'bn' ? '✅ পোস্ট সফলভাবে প্রকাশিত হয়েছে!' : '✅ Post published successfully!', 'success')
      onPostCreated()
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: colors.cardBg,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: '12px',
      padding: '12px',
      marginBottom: '16px',
      textAlign: 'left',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={lang === 'bn' ? 'শিরোনাম (ঐচ্ছিক)' : 'Title (optional)'}
        style={{
          width: '100%',
          padding: '6px 8px',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${colors.cardBorder}`,
          color: colors.text,
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '8px',
          boxSizing: 'border-box',
          outline: 'none',
          textAlign: 'left'
        }}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={translations[lang].postPlaceholder}
        rows={2}
        style={{
          width: '100%',
          padding: '6px 8px',
          background: 'transparent',
          border: 'none',
          color: colors.text,
          fontSize: '14px',
          lineHeight: '1.5',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          resize: 'vertical',
          outline: 'none',
          textAlign: 'left'
        }}
        required
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', borderTop: `1px solid ${colors.cardBorder}`, paddingTop: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              padding: '6px 10px',
              background: colors.inputBg,
              color: colors.text,
              border: `1px solid ${colors.inputBorder}`,
              borderRadius: '8px',
              fontSize: '12px',
              outline: 'none'
            }}
          >
            {CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{lang === 'bn' ? c.bn : c.en}</option>
            ))}
          </select>
          {(title || content) && (
            <span style={{ fontSize: '11px', color: colors.textMuted }}>
              💾 {lang === 'bn' ? 'ড্রাফট সংরক্ষিত' : 'Draft saved'}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={posting}
          style={{
            padding: '6px 18px',
            background: '#0066cc',
            color: '#fff',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            minHeight: '36px'
          }}
        >
          {posting ? translations[lang].posting : translations[lang].postButton}
        </button>
      </div>
    </form>
  )
}

function AdminDashboardModal({ isOpen, onClose, supabase }) {
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (showLoading = false) => {
    if (showLoading) setLoading(true);

    const { data: fbData, error: fbError } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });

    if (fbError) console.log('Feedback error:', fbError.message);

    const { data: repData, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    setFeedbacks(fbData || []);
    setReports(repData || []);
    if (showLoading) setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="admin-modal-content">
        <div className="admin-header">
          <h2>🛠️ Admin Dashboard</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            🚨 Reported Posts ({reports.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'feedbacks' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedbacks')}
          >
            💬 User Feedbacks ({feedbacks.length})
          </button>
        </div>

        <div className="admin-body">
          {loading ? (
            <p className="loading-text">লোড হচ্ছে...</p>
          ) : activeTab === 'reports' ? (
            reports.length === 0 ? (
              <p className="no-data">কোনো পোস্টের বিরুদ্ধে রিপোর্ট নেই।</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="admin-item-card">
                  <p><strong>কারণ:</strong> {report.reason}</p>
                  <p><strong>পোস্ট আইডি:</strong> {report.post_id}</p>
                  <small>{new Date(report.created_at).toLocaleString()}</small>
                </div>
              ))
            )
          ) : (
            feedbacks.length === 0 ? (
              <p className="no-data">কোনো ফিডব্যাক নেই।</p>
            ) : (
              feedbacks.map((fb) => (
                <div key={fb.id} className="admin-item-card">
                  <p><strong>ধরণ:</strong> {fb.type}</p>
                  <p>{fb.message || fb.content || JSON.stringify(fb)}</p>
                  <small>{new Date(fb.created_at).toLocaleString()}</small>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null)
  const [lang, setLang] = useState(localStorage.getItem('lekho_lang') || 'bn')
  
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('lekho_theme')
    if (saved) return saved
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })

  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('feed')
  const [feedTab, setFeedTab] = useState('explore')
  const [viewedUserId, setViewedUserId] = useState(null)
  const [singlePostId, setSinglePostId] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [showNavMenu, setShowNavMenu] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)

  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)

  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)

  const navMenuRef = useRef(null)

  useEffect(() => {
    window.history.pushState({ view: 'feed' }, '')

    const handlePopState = (event) => {
      if (view === 'profile' || view === 'notifications' || singlePostId || view === 'saved' || searchTerm) {
        setView('feed')
        setSinglePostId(null)
        setViewedUserId(null)
        setSearchTerm('')
        window.history.pushState({ view: 'feed' }, '')
      } else {
        window.history.pushState({ view: 'feed' }, '')
        setShowExitConfirm(true)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [view, singlePostId, searchTerm])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target)) {
        setShowNavMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const showToast = (message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
    }, 3200)
  }

  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('male')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  const [refreshFeed, setRefreshFeed] = useState(0)

  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email)

  useEffect(() => {
    if (singlePostId) {
      document.title = lang === 'bn' ? 'পোস্ট | লেখো' : 'Post | Lekho'
    } else if (view === 'profile') {
      document.title = lang === 'bn' ? 'প্রোফাইল | লেখো' : 'Profile | Lekho'
    } else if (view === 'notifications') {
      document.title = lang === 'bn' ? 'নোটিফিকেশন | লেখো' : 'Notifications | Lekho'
    } else if (view === 'saved') {
      document.title = lang === 'bn' ? 'সংরক্ষিত পোস্ট | লেখো' : 'Saved Posts | Lekho'
    } else {
      document.title = lang === 'bn' ? 'লেখো — আপনার ভাবনা প্রকাশ করুন' : 'Lekho — Share Your Thoughts'
    }
  }, [singlePostId, view, lang])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    localStorage.setItem('lekho_theme', nextTheme)
  }

  const handleSetLang = (newLang) => {
    setLang(newLang)
    localStorage.setItem('lekho_lang', newLang)
  }

  const isDark = theme === 'dark'
  
  const colors = {
    bg: isDark ? '#121316' : '#f1f5f9',
    cardBg: isDark ? '#191a1d' : '#ffffff',
    cardBorder: isDark ? '#2e3035' : '#cbd5e1',
    text: isDark ? '#f3f4f6' : '#0f172a',
    textMuted: isDark ? '#9ca3af' : '#475569',
    inputBg: isDark ? '#111215' : '#ffffff',
    inputBorder: isDark ? '#373a40' : '#94a3b8',
    navBg: isDark ? '#1a1b1f' : '#ffffff',
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const postId = params.get('post')
    if (postId) {
      setSinglePostId(postId)
      setView('feed')
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) loadNotifications(session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true)
      }
      setSession(session)
      if (session) loadNotifications(session.user.id)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const loadNotifications = async (userId) => {
    const uid = userId || session?.user?.id
    if (!uid) return

    const { data } = await supabase
      .from('notifications')
      .select('*, profiles:actor_id(name, full_name, avatar_url), posts(title)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      const prevUnread = unreadNotifCount
      const unread = data.filter(n => !n.is_read).length
      setNotifications(data)
      setUnreadNotifCount(unread)

      if (unread > prevUnread && prevUnread !== 0) {
        playPopSound()
      }
    }
  }

  const markNotificationsAsRead = async () => {
    if (!session || unreadNotifCount === 0) return

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false)

    setUnreadNotifCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const handleOpenNotifications = () => {
    setView('notifications')
    setSinglePostId(null)
    setViewedUserId(null)
    setSearchTerm('')
    markNotificationsAsRead()
  }

  const handleNotificationClick = (notif) => {
    if (notif.type === 'follow') {
      setViewedUserId(notif.actor_id)
      setView('profile')
    } else if (notif.post_id) {
      setSinglePostId(notif.post_id)
      setView('feed')
    }
  }

  const handleSignUp = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          full_name: name,
          gender: gender
        }
      }
    })

    if (error) {
      setErrorMsg(error.message)
    } else if (data?.user) {
      await supabase.from('profiles').update({
        gender: gender,
        full_name: name,
        name: name
      }).eq('id', data.user.id)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) setErrorMsg(error.message)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })

    if (error) {
      setErrorMsg(error.message)
    } else {
      setSuccessMsg(lang === 'bn' 
        ? 'আপনার ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে! ইনবক্স চেক করুন।' 
        : 'Password reset link sent to your email! Please check your inbox.')
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setUpdatingPassword(true)

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    setUpdatingPassword(false)

    if (error) {
      setErrorMsg(error.message)
    } else {
      showToast(lang === 'bn' ? '✅ পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!' : '✅ Password updated successfully!', 'success')
      setIsPasswordRecovery(false)
      setNewPassword('')
    }
  }

  const handleLogout = async () => {
    setShowNavMenu(false)
    await supabase.auth.signOut()
  }

  const handleDeleteAccount = async () => {
    const confirmText = lang === 'bn' ? 'আপনি কি সত্যিই আপনার অ্যাকাউন্ট এবং সমস্ত ডেটা চিরতরে মুছে ফেলতে চান?' : 'Are you sure you want to delete your account permanently?'
    if (!window.confirm(confirmText)) return

    const userId = session.user.id
    await supabase.from('posts').delete().eq('author_id', userId)
    await supabase.from('profiles').delete().eq('id', userId)
    
    await supabase.auth.signOut()
    showToast(lang === 'bn' ? 'অ্যাকাউন্ট মুছে ফেলা হয়েছে।' : 'Account deleted.', 'info')
  }

  const handleFeedTabClick = () => {
    setView('feed')
    setSinglePostId(null)
    setViewedUserId(null)
    setSearchTerm('')
    setRefreshFeed(r => r + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    window.history.pushState({}, '', window.location.pathname)
  }

  const clearSinglePostView = () => {
    setSinglePostId(null)
    window.history.pushState({}, '', window.location.pathname)
  }

  if (loading) return <p style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>Loading...</p>

  if (isPasswordRecovery) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, padding: '40px 15px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '400px', margin: '40px auto 0', fontFamily: 'sans-serif', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <Logo size={46} isDark={isDark} />
            <h1 style={{ margin: 0, fontSize: '26px', color: colors.text }}>{translations[lang].appName}</h1>
          </div>

          <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '16px', color: colors.text }}>
            🔒 {lang === 'bn' ? 'নতুন পাসওয়ার্ড সেট করুন' : 'Set New Password'}
          </h2>

          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: '15px' }}>
              <input
                type="password"
                placeholder={lang === 'bn' ? 'কমপক্ষে ৬ ডিজিটের নতুন পাসওয়ার্ড' : 'Enter new password (min 6 chars)'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, boxSizing: 'border-box', fontSize: '15px' }}
              />
            </div>

            {errorMsg && <p style={{ color: '#ff4d4f', fontSize: '14px', margin: '0 0 10px' }}>{errorMsg}</p>}

            <button type="submit" disabled={updatingPassword} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#0066cc', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', minHeight: '44px' }}>
              {updatingPassword ? '...' : (lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন সম্পন্ন করুন' : 'Update Password')}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, padding: '40px 15px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto', fontFamily: 'sans-serif', textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
            <Logo size={46} isDark={isDark} />
            <h1 style={{ margin: 0, fontSize: '26px', color: colors.text }}>{translations[lang].appName}</h1>
          </div>

          <h2 style={{ textAlign: 'center', fontSize: '18px', marginBottom: '20px', color: colors.text }}>
            {authMode === 'signup' && (lang === 'bn' ? 'নতুন একাউন্ট তৈরি করুন' : translations[lang].createAccount)}
            {authMode === 'login' && (lang === 'bn' ? 'লগইন করুন' : translations[lang].login)}
            {authMode === 'forgot' && (lang === 'bn' ? 'পাসওয়ার্ড রিসেট করুন' : 'Reset Password')}
          </h2>

          <form onSubmit={
            authMode === 'signup' ? handleSignUp : authMode === 'login' ? handleLogin : handleForgotPassword
          }>
            {authMode === 'signup' && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    placeholder={translations[lang].namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, boxSizing: 'border-box', fontSize: '15px' }}
                  />
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', color: colors.textMuted, fontWeight: '600' }}>
                    {lang === 'bn' ? 'লিঙ্গ / জেন্ডার' : 'Gender'}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, boxSizing: 'border-box', fontSize: '15px' }}
                  >
                    <option value="male">{lang === 'bn' ? 'পুরুষ (Male)' : 'Male'}</option>
                    <option value="female">{lang === 'bn' ? 'নারী (Female)' : 'Female'}</option>
                    <option value="other">{lang === 'bn' ? 'অন্যান্য (Other)' : 'Other'}</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ marginBottom: '12px' }}>
              <input
                type="email"
                placeholder={translations[lang].emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, boxSizing: 'border-box', fontSize: '15px' }}
              />
            </div>

            {authMode !== 'forgot' && (
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="password"
                  placeholder={translations[lang].passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${colors.inputBorder}`, background: colors.inputBg, color: colors.text, boxSizing: 'border-box', fontSize: '15px' }}
                />
              </div>
            )}

            {authMode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: '15px' }}>
                <button
                  type="button"
                  onClick={() => { setAuthMode('forgot'); setErrorMsg(''); setSuccessMsg('') }}
                  style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', fontSize: '13px', padding: 0 }}
                >
                  {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot Password?'}
                </button>
              </div>
            )}

            {errorMsg && <p style={{ color: '#ff4d4f', fontSize: '13.5px', margin: '0 0 10px', fontWeight: '600' }}>{errorMsg}</p>}
            {successMsg && <p style={{ color: '#10b981', fontSize: '13.5px', margin: '0 0 10px', fontWeight: '600' }}>{successMsg}</p>}

            <button type="submit" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#0066cc', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', minHeight: '44px' }}>
              {authMode === 'signup' && translations[lang].signUp}
              {authMode === 'login' && translations[lang].login}
              {authMode === 'forgot' && (lang === 'bn' ? 'রিসেট লিংক পাঠান' : 'Send Reset Link')}
            </button>
          </form>

          <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '14px' }}>
            {authMode === 'forgot' ? (
              <button onClick={() => { setAuthMode('login'); setErrorMsg(''); setSuccessMsg('') }} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline' }}>
                ← {lang === 'bn' ? 'লগইনে ফিরে যান' : 'Back to Login'}
              </button>
            ) : (
              <p style={{ margin: 0, color: colors.text }}>
                {authMode === 'signup' ? translations[lang].haveAccount : translations[lang].newUser}{' '}
                <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setErrorMsg(''); setSuccessMsg('') }} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}>
                  {authMode === 'signup' ? translations[lang].switchToLogin : translations[lang].switchToSignUp}
                </button>
              </p>
            )}
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '13.5px' }}>
            <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: colors.text, cursor: 'pointer', fontWeight: '600' }}>
              {isDark ? `☀️ ${translations[lang].dayMode}` : `🌙 ${translations[lang].nightMode}`}
            </button>
            <span style={{ color: colors.cardBorder }}>|</span>
            <div>
              <span onClick={() => handleSetLang('bn')} style={{ cursor: 'pointer', color: lang === 'bn' ? '#0066cc' : colors.textMuted, fontWeight: lang === 'bn' ? 'bold' : 'normal' }}>বাংলা</span>
              {' / '}
              <span onClick={() => handleSetLang('en')} style={{ cursor: 'pointer', color: lang === 'en' ? '#0066cc' : colors.textMuted, fontWeight: lang === 'en' ? 'bold' : 'normal' }}>EN</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, transition: 'background-color 0.3s ease, color 0.3s ease', display: 'flex', flexDirection: 'column' }}>
      
      <style>{`
        *, *::before, *::after {
          transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes popScale {
          0% { transform: scale(1); }
          50% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        .reaction-pop {
          animation: popScale 0.25s ease-in-out;
        }
      `}</style>

      {showExitConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10000, padding: '15px'
        }}>
          <div style={{
            background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '14px',
            maxWidth: '320px', width: '100%', padding: '20px', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 10px', color: colors.text, fontSize: '18px' }}>
              {lang === 'bn' ? 'আপনি কি সাইট ছেড়ে যেতে চান?' : 'Do you want to leave this site?'}
            </h3>
            <p style={{ color: colors.textMuted, fontSize: '13.5px', margin: '0 0 20px' }}>
              {lang === 'bn' ? 'আপনি লেখো প্ল্যাটফর্ম থেকে বের হয়ে যাচ্ছেন।' : 'You are exiting Lekho platform.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  flex: 1, padding: '10px', background: isDark ? '#333' : '#e2e8f0', color: colors.text,
                  border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
                }}
              >
                No
              </button>
              <button
                onClick={() => {
                  window.history.back()
                }}
                style={{
                  flex: 1, padding: '10px', background: '#ff4d4f', color: '#fff',
                  border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#0066cc',
          color: '#ffffff',
          padding: '10px 22px',
          borderRadius: '24px',
          fontSize: '13.5px',
          fontWeight: 'bold',
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
          animation: 'slideIn 0.25s ease-out',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{toast.message}</span>
        </div>
      )}

      <div style={{ maxWidth: '620px', width: '100%', margin: '0 auto', fontFamily: 'sans-serif', padding: '15px 12px', boxSizing: 'border-box', flex: 1 }}>
        
        {view === 'profile' ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: colors.cardBg,
              borderRadius: '12px',
              border: `1px solid ${colors.cardBorder}`,
              marginBottom: '15px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => { setView('feed'); setViewedUserId(null); clearSinglePostView() }}
                style={{
                  background: isDark ? '#25262a' : '#f1f5f9',
                  color: '#0066cc',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '8px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 'bold',
                  minHeight: '38px'
                }}
              >
                ← {lang === 'bn' ? 'ফিডে ফিরে যান' : 'Feed'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Logo size={30} isDark={isDark} />
                <span style={{ fontWeight: 'bold', fontSize: '16px', color: colors.text }}>{translations[lang].appName}</span>
              </div>

              <button
                onClick={toggleTheme}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '6px' }}
                title={isDark ? 'Day Mode' : 'Night Mode'}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>

            <ProfileNoteBox
              profileUserId={viewedUserId || session.user.id}
              session={session}
              lang={lang}
              colors={colors}
              isDark={isDark}
              showToast={showToast}
            />

            <ProfilePage
              session={session}
              lang={lang}
              theme={theme}
              targetUserId={viewedUserId}
              PostCard={(props) => <PostCard {...props} showToast={showToast} />}
              onViewProfile={(userId) => { setViewedUserId(userId); setView('profile') }}
              onAvatarClick={(avatarData) => setAvatarPreview(avatarData)}
            />
          </div>
        ) : view === 'notifications' ? (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: colors.cardBg,
              borderRadius: '12px',
              border: `1px solid ${colors.cardBorder}`,
              marginBottom: '15px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}>
              <button
                onClick={() => setView('feed')}
                style={{
                  background: isDark ? '#25262a' : '#f1f5f9',
                  color: '#0066cc',
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: '8px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: 'bold',
                  minHeight: '38px'
                }}
              >
                ← {lang === 'bn' ? 'ফিডে ফিরে যান' : 'Feed'}
              </button>

              <h2 style={{ margin: 0, fontSize: '17px', color: colors.text }}>
                🔔 {lang === 'bn' ? 'সকল নোটিফিকেশন' : 'All Notifications'}
              </h2>

              <button
                onClick={toggleTheme}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '6px' }}
                title={isDark ? 'Day Mode' : 'Night Mode'}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>

            <div style={{
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              {notifications.length === 0 ? (
                <p style={{ textAlign: 'center', color: colors.textMuted, fontSize: '14px', margin: '40px 0' }}>
                  {lang === 'bn' ? 'কোনো নোটিফিকেশন নেই।' : 'No notifications yet.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map(n => {
                    const actor = n.profiles
                    const actorName = actor?.full_name || actor?.name || (lang === 'bn' ? 'একজন পাঠক' : 'A reader')
                    let text = ''

                    if (n.type === 'love') text = lang === 'bn' ? 'আপনার লেখায় লাভ (❤️) দিয়েছেন।' : 'loved your post.'
                    else if (n.type === 'insightful') text = lang === 'bn' ? 'আপনার লেখায় তথ্যবহুল (💡) দিয়েছেন।' : 'found your post insightful.'
                    else if (n.type === 'comment') text = lang === 'bn' ? 'আপনার লেখায় মন্তব্য করেছেন।' : 'commented on your post.'
                    else if (n.type === 'reply') text = lang === 'bn' ? 'আপনার মন্তব্যে রিপ্লাই দিয়েছেন।' : 'replied to your comment.'
                    else if (n.type === 'follow') text = lang === 'bn' ? 'আপনাকে ফলো করা শুরু করেছেন।' : 'started following you.'

                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          borderRadius: '10px',
                          background: n.is_read ? (isDark ? '#191a1d' : '#ffffff') : (isDark ? '#25262c' : '#f1f5f9'),
                          cursor: 'pointer',
                          border: `1px solid ${colors.cardBorder}`
                        }}
                      >
                        {actor?.avatar_url ? (
                          <img src={actor.avatar_url} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%', flexShrink: 0, border: '1.5px solid #0066cc' }} />
                        ) : (
                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: isDark ? '#444' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                            👤
                          </div>
                        )}
                        <div style={{ flex: 1, fontSize: '14px', textAlign: 'left' }}>
                          <strong style={{ color: '#0066cc' }}>{actorName}</strong>{' '}
                          <span style={{ color: colors.text }}>{text}</span>
                          <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '4px' }}>
                            {formatDateTime(n.created_at, lang)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div
              onClick={handleFeedTabClick}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '14px', cursor: 'pointer' }}
            >
              <Logo size={42} isDark={isDark} />
              <h1 style={{ margin: 0, fontSize: '24px', letterSpacing: '0.8px', color: colors.text }}>{translations[lang].appName}</h1>
            </div>

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  if (view !== 'feed') setView('feed')
                  if (singlePostId) clearSinglePostView()
                }}
                placeholder={lang === 'bn' ? '🔍 খুঁজুন... (@ইউজার, #ট্যাগ বা পোস্ট)' : '🔍 Search... (@user, #tag or post)'}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 14px',
                  borderRadius: '24px',
                  border: `1px solid ${colors.inputBorder}`,
                  background: colors.inputBg,
                  color: colors.text,
                  fontSize: '14.5px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  textAlign: 'left'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: colors.textMuted,
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: colors.navBg,
              borderRadius: '12px',
              border: `1px solid ${colors.cardBorder}`,
              marginBottom: '15px',
              position: 'relative',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleFeedTabClick}
                  style={{
                    background: view === 'feed' && !singlePostId ? (isDark ? '#333' : '#e2e8f0') : 'transparent',
                    color: view === 'feed' && !singlePostId ? colors.text : colors.textMuted,
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: view === 'feed' && !singlePostId ? 'bold' : 'normal',
                    minHeight: '38px'
                  }}
                >
                  🏠 {lang === 'bn' ? 'ফিড' : 'Feed'}
                </button>

                <button
                  onClick={() => { setView('saved'); clearSinglePostView(); setViewedUserId(null) }}
                  style={{
                    background: view === 'saved' ? (isDark ? '#333' : '#e2e8f0') : 'transparent',
                    color: view === 'saved' ? colors.text : colors.textMuted,
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: view === 'saved' ? 'bold' : 'normal',
                    minHeight: '38px'
                  }}
                >
                  📑 {lang === 'bn' ? 'সেভড' : 'Saved'}
                </button>

                <button
                  onClick={handleOpenNotifications}
                  style={{
                    background: 'transparent',
                    color: unreadNotifCount > 0 ? '#ff9900' : colors.textMuted,
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    fontWeight: unreadNotifCount > 0 ? 'bold' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    minHeight: '38px'
                  }}
                >
                  🔔 {lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
                  {unreadNotifCount > 0 && (
                    <span style={{
                      background: '#ff3366',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '1px 6px',
                      fontSize: '10px',
                      fontWeight: 'bold'
                    }}>
                      {unreadNotifCount}
                    </span>
                  )}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={toggleTheme}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    padding: '6px'
                  }}
                  title={isDark ? 'Switch to Day Mode' : 'Switch to Night Mode'}
                >
                  {isDark ? '☀️' : '🌙'}
                </button>

                <div ref={navMenuRef} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowNavMenu(!showNavMenu)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.text,
                      fontSize: '20px',
                      cursor: 'pointer',
                      padding: '6px'
                    }}
                  >
                    ⋮
                  </button>

                  {showNavMenu && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '36px',
                      background: colors.cardBg,
                      border: `1px solid ${colors.cardBorder}`,
                      borderRadius: '10px',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                      zIndex: 100,
                      minWidth: '190px',
                      padding: '6px 0',
                      textAlign: 'left'
                    }}>
                      <button
                        onClick={() => {
                          setViewedUserId(null)
                          setView('profile')
                          setShowNavMenu(false)
                        }}
                        style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: colors.text, textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                      >
                        👤 {lang === 'bn' ? 'নিজের প্রোফাইল' : 'My Profile'}
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setShowAdminModal(true)
                            setShowNavMenu(false)
                          }}
                          style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: '#0066cc', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                        >
                          🛠️ {lang === 'bn' ? 'অ্যাডমিন প্যানেল' : 'Admin Panel'}
                        </button>
                      )}

                      <div style={{ padding: '8px 16px', fontSize: '13px', color: colors.textMuted, borderTop: `1px solid ${colors.cardBorder}`, borderBottom: `1px solid ${colors.cardBorder}` }}>
                        🌐 {lang === 'bn' ? 'ভাষা:' : 'Lang:'}{' '}
                        <span onClick={() => handleSetLang('bn')} style={{ cursor: 'pointer', color: lang === 'bn' ? '#0066cc' : colors.textMuted, fontWeight: lang === 'bn' ? 'bold' : 'normal' }}>বাংলা</span>
                        {' | '}
                        <span onClick={() => handleSetLang('en')} style={{ cursor: 'pointer', color: lang === 'en' ? '#0066cc' : colors.textMuted, fontWeight: lang === 'en' ? 'bold' : 'normal' }}>EN</span>
                      </div>

                      <button
                        onClick={handleDeleteAccount}
                        style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: '#ff4d4f', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                      >
                        ⚠️ {lang === 'bn' ? 'অ্যাকাউন্ট ডিলিট করুন' : 'Delete Account'}
                      </button>

                      <button
                        onClick={handleLogout}
                        style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: colors.text, textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: '500', borderTop: `1px solid ${colors.cardBorder}` }}
                      >
                        🚪 {translations[lang].logout}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {view === 'feed' && !singlePostId && !searchTerm && (
              <div style={{ display: 'flex', borderBottom: `2px solid ${colors.cardBorder}`, marginBottom: '16px' }}>
                <button
                  onClick={() => setFeedTab('explore')}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: feedTab === 'explore' ? '3px solid #0066cc' : 'none',
                    color: feedTab === 'explore' ? '#0066cc' : colors.textMuted,
                    fontWeight: feedTab === 'explore' ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '14px',
                    minHeight: '40px'
                  }}
                >
                  🔥 {lang === 'bn' ? 'সবার জন্য' : 'Explore'}
                </button>

                <button
                  onClick={() => setFeedTab('trending')}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: feedTab === 'trending' ? '3px solid #0066cc' : 'none',
                    color: feedTab === 'trending' ? '#0066cc' : colors.textMuted,
                    fontWeight: feedTab === 'trending' ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '14px',
                    minHeight: '40px'
                  }}
                >
                  📈 {lang === 'bn' ? 'ট্রেন্ডিং' : 'Trending'}
                </button>

                <button
                  onClick={() => setFeedTab('following')}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: 'none',
                    border: 'none',
                    borderBottom: feedTab === 'following' ? '3px solid #0066cc' : 'none',
                    color: feedTab === 'following' ? '#0066cc' : colors.textMuted,
                    fontWeight: feedTab === 'following' ? 'bold' : 'normal',
                    cursor: 'pointer',
                    fontSize: '14px',
                    minHeight: '40px'
                  }}
                >
                  👥 {lang === 'bn' ? 'ফলোয়িং' : 'Following'}
                </button>
              </div>
            )}

            {view === 'feed' && !singlePostId && (
              <NewPostForm
                session={session}
                lang={lang}
                colors={colors}
                isDark={isDark}
                showToast={showToast}
                onPostCreated={() => setRefreshFeed(r => r + 1)}
              />
            )}

            <Feed
              session={session}
              lang={lang}
              colors={colors}
              isDark={isDark}
              searchTerm={searchTerm}
              viewMode={view}
              feedTab={feedTab}
              singlePostId={singlePostId}
              refreshFeed={refreshFeed}
              showToast={showToast}
              onViewProfile={(userId) => { setViewedUserId(userId); setView('profile') }}
              onAvatarClick={(avatarData) => setAvatarPreview(avatarData)}
              onOpenOriginalPost={(postId) => {
                setSinglePostId(postId)
                window.scrollTo({ top: 0, behavior: 'smooth' })
                window.history.pushState({}, '', `?post=${postId}`)
              }}
            />
          </>
        )}

        {avatarPreview && (
          <div
            onClick={() => setAvatarPreview(null)}
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(3px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '20px'
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: colors.cardBg, border: `1px solid ${colors.cardBorder}`, borderRadius: '16px',
                padding: '24px 20px', textAlign: 'center', maxWidth: '300px', width: '100%',
                boxShadow: '0 8px 30px rgba(0,0,0,0.4)', position: 'relative'
              }}
            >
              <button
                onClick={() => setAvatarPreview(null)}
                style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: colors.textMuted, fontSize: '18px', cursor: 'pointer', padding: '6px' }}
              >
                ✕
              </button>

              <img
                src={avatarPreview.url}
                alt=""
                style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  border: '3px solid #0066cc', boxShadow: '0 4px 15px rgba(0,102,204,0.3)',
                  margin: '0 auto 15px', display: 'block'
                }}
              />

              <h3 style={{ margin: '0 0 6px', color: colors.text, fontSize: '18px' }}>{avatarPreview.name}</h3>

              <button
                onClick={() => {
                  const uid = avatarPreview.userId
                  setAvatarPreview(null)
                  if (uid) {
                    setViewedUserId(uid)
                    setView('profile')
                  }
                }}
                style={{
                  marginTop: '12px', padding: '10px 20px', background: '#0066cc', color: '#fff',
                  border: 'none', borderRadius: '20px', cursor: 'pointer', fontSize: '13.5px', fontWeight: 'bold'
                }}
              >
                👤 {lang === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}
              </button>
            </div>
          </div>
        )}

      </div>

      {view !== 'profile' && view !== 'notifications' && (
        <footer style={{
          marginTop: 'auto',
          borderTop: `1px solid ${colors.cardBorder}`,
          padding: '18px 12px',
          textAlign: 'center',
          background: colors.cardBg
        }}>
          <button
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: 'none',
              border: `1px solid ${colors.cardBorder}`,
              color: '#0066cc',
              padding: '8px 18px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13.5px',
              fontWeight: 'bold',
              minHeight: '40px'
            }}
          >
            💡 {lang === 'bn' ? 'মতামত বা সমস্যা জানান (Feedback)' : 'Send Feedback / Report Issue'}
          </button>
          <div style={{ fontSize: '12px', color: colors.textMuted, marginTop: '10px' }}>
            © 2026 {translations[lang].appName}. All rights reserved.
          </div>
        </footer>
      )}

      {showFeedbackModal && (
        <FeedbackModal
          session={session}
          lang={lang}
          colors={colors}
          isDark={isDark}
          showToast={showToast}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}

      {showAdminModal && isAdmin && (
        <AdminDashboardModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          supabase={supabase}
        />
      )}

    </div>
  )
}