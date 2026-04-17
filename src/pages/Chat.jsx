import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { db, chatMessagesCollection, doc, setDoc, query, where, onSnapshot } from '../firebase'

export default function Chat() {
  const { user, getAllUsers } = useAuth()
  const location = useLocation()
  
  if (!user) {
    return (
      <div className="page" style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: 'white' }}>Please log in</h2>
      </div>
    )
  }
  const [activeChat, setActiveChat] = useState('main')
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [showMediaOptions, setShowMediaOptions] = useState(false)
  const [showChatList, setShowChatList] = useState(false)
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
      if (window.innerWidth >= 768) {
        setShowChatList(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const allUsers = getAllUsers()
  const currentUser = allUsers.find(u => u.id === user?.id)
  const divisions = ['Elite', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Iron']

  let friendIds = []
  if (user?.friends) {
    friendIds = user.friends
  } else if (currentUser?.friends) {
    friendIds = currentUser.friends
  }
  
  const friends = allUsers.filter(u => friendIds.includes(u.id))
  
  const chatList = [
    { id: 'main', name: 'Main Chat', type: 'general' },
    { id: 'announcements', name: 'Announcements', type: 'general' },
    ...(user?.isAdmin ? [{ id: 'admin', name: 'Admin Chat', type: 'admin' }] : []),
    ...divisions.map(d => ({ id: `division_${d}`, name: `${d} Division`, type: 'division' })),
    ...friends.map(f => ({ id: `friend_${f.id}`, name: f.username, type: 'friend', isOnline: f.isOnline }))
  ]

  const getChatKey = (chatId) => {
    if (chatId.startsWith('friend_')) {
      return 'friend_' + chatId.replace('friend_', '')
    }
    return chatId
  }

  useEffect(() => {
    if (location.state?.openChat) {
      setActiveChat(location.state.openChat)
      setShowChatList(false)
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  useEffect(() => {
    let chatKey = getChatKey(activeChat)
    setMessages([])
    
    try {
      const q = query(
        chatMessagesCollection,
        where('chatKey', '==', chatKey)
      )
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        try {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          msgs.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
          setMessages(msgs)
        } catch (err) {
          console.error('Error processing messages:', err)
        }
      }, (error) => {
        console.error('Firestore error:', error)
      })
      
      return () => unsubscribe()
    } catch (err) {
      console.error('Query error:', err)
    }
  }, [activeChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    if (activeChat === 'announcements' && !user.isAdmin) {
      alert('Only admins can post announcements')
      return
    }

    if (activeChat.startsWith('friend_')) {
      const friendId = activeChat.replace('friend_', '')
      const friend = allUsers.find(u => u.id === friendId)
      if (friend?.doNotDisturb && friend.dndEndTime && new Date(friend.dndEndTime) > new Date()) {
        alert('This player has Do Not Disturb enabled. Your message will be sent but they won\'t receive a notification.')
      }
    }

    const msg = {
      chatKey: getChatKey(activeChat),
      sender: user.username,
      senderId: user.id,
      text: newMessage,
      timestamp: new Date().toISOString(),
      replyTo: replyTo ? { ...replyTo } : null,
      editHistory: editingMessage ? { originalText: editingMessage.text, editedAt: new Date().toISOString() } : null,
      media: null,
      type: 'text'
    }

    if (editingMessage) {
      await setDoc(doc(db, 'chatMessages', editingMessage.id.toString()), { ...editingMessage, text: newMessage, edited: true, editHistory: msg.editHistory }, { merge: true })
      setEditingMessage(null)
    } else {
      await setDoc(doc(db, 'chatMessages', Date.now().toString()), msg)
    }

    setNewMessage('')
    setReplyTo(null)
  }

  const handleMediaUpload = (type) => {
    if (type === 'photo' || type === 'video') {
      fileInputRef.current?.click()
    } else if (type === 'voice') {
      alert('Voice recording coming soon!')
    }
    setShowMediaOptions(false)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async () => {
      const msg = {
        chatKey: getChatKey(activeChat),
        sender: user.username,
        senderId: user.id,
        text: '',
        timestamp: new Date().toISOString(),
        media: reader.result,
        mediaType: file.type.startsWith('video') ? 'video' : 'photo',
        type: 'media'
      }
      await setDoc(doc(db, 'chatMessages', Date.now().toString()), msg)
    }
    reader.readAsDataURL(file)
  }

  const handleReply = (msg) => setReplyTo(msg)
  const handleEdit = (msg) => { if (msg.senderId === user.id) { setEditingMessage(msg); setNewMessage(msg.text) }}
  const handleDelete = (msgId) => { if (confirm('Delete this message?')) setMessages(prev => prev.filter(m => m.id !== msgId)) }

  const getChatTitle = () => {
    if (activeChat === 'announcements') return 'Announcements'
    if (activeChat === 'main') return 'Main Chat'
    if (activeChat.startsWith('division_')) return activeChat.replace('division_', '') + ' Division'
    if (activeChat.startsWith('friend_')) {
      const friendId = activeChat.replace('friend_', '')
      const friend = allUsers.find(u => u.id === friendId)
      return friend ? friend.username : 'Chat'
    }
    return 'Chat'
  }

  return (
    <div className="page" style={{ height: 'calc(100vh - 100px)', display: 'flex', padding: 0, position: 'relative' }}>
      {showChatList && isDesktop && (
        <div 
          onClick={() => setShowChatList(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 10
          }}
        />
      )}
      {showChatList && (
        <div className="card" style={{ 
          width: '280px', 
          minWidth: '280px',
          borderRadius: '12px 0 0 12px',
          display: 'flex',
          flexDirection: 'column',
          marginRight: '1px',
          overflow: 'hidden',
          position: isDesktop ? 'absolute' : 'relative',
          left: isDesktop ? '0' : undefined,
          top: isDesktop ? '0' : undefined,
          height: isDesktop ? '100%' : undefined,
          zIndex: 20
        }}>
          <div style={{ padding: '15px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600' }}>Chats</h2>
            {isDesktop && (
              <button 
                onClick={() => setShowChatList(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            )}
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {chatList.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No chats available
              </div>
            ) : (
              chatList.map(chat => (
              <button
                key={chat.id}
                onClick={() => { setActiveChat(chat.id); setShowChatList(false) }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  background: activeChat === chat.id ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  color: 'var(--text-primary)',
                  marginBottom: '4px'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  flexShrink: 0
                }}>
                  {chat.name.charAt(0)}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: '500', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {chat.name}
                  </div>
                  {chat.type === 'friend' && chat.showOnlineStatus !== false && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%',
                        background: chat.isOnline ? 'var(--success)' : 'var(--text-muted)'
                      }} />
                      <span style={{ fontSize: '0.75rem', color: chat.isOnline ? 'var(--success)' : 'var(--text-muted)' }}>
                        {chat.isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))
            )}
          </div>
        </div>
      )}

      <div className="card" style={{ 
        flex: 1, 
        borderRadius: '0 12px 12px 0',
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ 
          padding: '15px', 
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '8px 12px' }}
            onClick={() => setShowChatList(true)}
          >
            ☰
          </button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', flex: 1 }}>{getChatTitle()}</h2>
        </div>

        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className={`chat-message ${msg.senderId === user.id ? 'own' : 'other'}`}
              style={{ maxWidth: '70%' }}
            >
              {msg.replyTo && (
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-muted)', 
                  padding: '6px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                  marginBottom: '6px'
                }}>
                  ↩ {msg.replyTo.text?.substring(0, 25)}...
                </div>
              )}
              
              <div className="chat-message-sender" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginBottom: '2px' }}>
                {msg.sender}
                {msg.edited && <span style={{ fontSize: '0.65rem', marginLeft: '4px' }}>(edited)</span>}
              </div>
              
              {msg.type === 'media' && msg.media && (
                msg.mediaType === 'video' ? (
                  <video src={msg.media} style={{ maxWidth: '180px', borderRadius: '8px' }} controls />
                ) : (
                  <img src={msg.media} alt="uploaded" style={{ maxWidth: '180px', borderRadius: '8px' }} />
                )
              )}
              
              <div style={{ fontSize: '0.95rem' }}>{msg.text}</div>
              <div className="chat-message-time" style={{ fontSize: '0.7rem', textAlign: 'right', marginTop: '2px' }}>
                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
              
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                <button style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} onClick={() => handleReply(msg)}>Reply</button>
                {msg.senderId === user.id && (
                  <>
                    <button style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0 4px' }} onClick={() => handleEdit(msg)}>Edit</button>
                    <button style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 0 }} onClick={() => handleDelete(msg.id)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input" onSubmit={handleSend} style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button 
              type="button"
              className="btn btn-secondary"
              style={{ padding: '8px 10px' }}
              onClick={() => setShowMediaOptions(!showMediaOptions)}
            >
              +
            </button>
            
            {showMediaOptions && (
              <div style={{ 
                position: 'absolute', 
                bottom: '45px', 
                left: '0',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                zIndex: 10
              }}>
                <button type="button" className="btn btn-secondary btn-block" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleMediaUpload('photo')}>📷 Photo</button>
                <button type="button" className="btn btn-secondary btn-block" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleMediaUpload('video')}>🎥 Video</button>
                <button type="button" className="btn btn-secondary btn-block" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleMediaUpload('voice')}>🎤 Voice</button>
              </div>
            )}
          </div>
          
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*,video/*" onChange={handleFileChange} />

          {replyTo && (
            <div style={{ 
              position: 'absolute', 
              bottom: '60px', 
              left: '60px',
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              padding: '4px 8px',
              background: 'var(--bg-secondary)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>Replying to: {replyTo.text?.substring(0, 20)}...</span>
              <button type="button" onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
          )}

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={editingMessage ? 'Edit message...' : 'Type a message...'}
            style={{ flex: 1, padding: '10px 14px' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 16px' }}>
            {editingMessage ? '✎' : '➤'}
          </button>
        </form>
      </div>
    </div>
  )
}