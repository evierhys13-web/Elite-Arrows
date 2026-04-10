import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const ADMIN_EMAIL = 'rhyshowe2023@outlook.com';

function getDivisionFromAverage(average) {
  if (average >= 55) return 'Elite';
  if (average >= 50) return 'Premier';
  if (average >= 45) return 'Champion';
  if (average >= 40) return 'Diamond';
  return 'Gold';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('eliteArrowsUser');
    const rememberMe = localStorage.getItem('eliteArrowsRemember');
    
    if (storedUser && rememberMe === 'true') {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const signUp = (userData, rememberMe = false) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    
    if (users.find(u => u.email === userData.email)) {
      throw new Error('Email already exists');
    }
    
    if (users.find(u => u.username === userData.username)) {
      throw new Error('Username already exists');
    }

    const isAdmin = userData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    const isTournamentAdmin = false;
    const division = getDivisionFromAverage(userData.threeDartAverage || 0);

    const newUser = {
      ...userData,
      id: Date.now().toString(),
      profilePicture: '',
      bio: '',
      nickname: '',
      dartCounterLink: '',
      threeDartAverage: userData.threeDartAverage || 0,
      division: division,
      isAdmin: isAdmin,
      isTournamentAdmin: isTournamentAdmin,
      isSubscribed: isAdmin,
      adminRequestPending: false,
      friends: [],
      isOnline: false,
      showOnlineStatus: true,
      doNotDisturb: false,
      dndEndTime: null,
      eliteTokens: 0,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
    
    if (rememberMe) {
      localStorage.setItem('eliteArrowsUser', JSON.stringify(newUser));
      localStorage.setItem('eliteArrowsRemember', 'true');
    }
    
    setUser(newUser);
    return newUser;
  };

  const signIn = (email, password, rememberMe = false) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    const foundUser = users.find(u => u.email === email && u.password === password);
    
    if (!foundUser) {
      throw new Error('Invalid email or password');
    }

    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      foundUser.isAdmin = true;
      foundUser.isSubscribed = true;
      const idx = users.findIndex(u => u.id === foundUser.id);
      if (idx >= 0) {
        users[idx] = foundUser;
        localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
      }
    }

    foundUser.isOnline = true;
    foundUser.lastSeen = new Date().toISOString();

    if (rememberMe) {
      localStorage.setItem('eliteArrowsUser', JSON.stringify(foundUser));
      localStorage.setItem('eliteArrowsRemember', 'true');
    } else {
      localStorage.removeItem('eliteArrowsUser');
      localStorage.setItem('eliteArrowsRemember', 'false');
    }
    
    setUser(foundUser);
    return foundUser;
  };

  const signOut = () => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].isOnline = false;
      users[userIndex].lastSeen = new Date().toISOString();
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
    }
    localStorage.removeItem('eliteArrowsUser');
    localStorage.setItem('eliteArrowsRemember', 'false');
    setUser(null);
  };

  const updateUser = (updates) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);
    
    if (userIndex !== -1) {
      let updatedData = { ...users[userIndex], ...updates };
      
      if (updates.threeDartAverage !== undefined) {
        updatedData.division = getDivisionFromAverage(updates.threeDartAverage);
      }
      
      users[userIndex] = updatedData;
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
      
      const rememberMe = localStorage.getItem('eliteArrowsRemember') === 'true';
      if (rememberMe) {
        localStorage.setItem('eliteArrowsUser', JSON.stringify(updatedData));
      }
      
      setUser(updatedData);
    }
  };

  const addFriend = (friendId) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);
    
    if (userIndex !== -1) {
      const currentFriends = users[userIndex].friends || [];
      if (!currentFriends.includes(friendId)) {
        users[userIndex].friends = [...currentFriends, friendId];
        localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
        setUser({ ...user, friends: [...currentFriends, friendId] });
      }
    }
  };

  const removeFriend = (friendId) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);
    
    if (userIndex !== -1) {
      const currentFriends = users[userIndex].friends || [];
      users[userIndex].friends = currentFriends.filter(id => id !== friendId);
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
      setUser({ ...user, friends: currentFriends.filter(id => id !== friendId) });
    }
  };

  const subscribe = () => {
    updateUser({ isSubscribed: true });
  };

  const requestAdminRole = () => {
    updateUser({ adminRequestPending: true });
  };

  const getAllUsers = () => {
    return JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
  };

  const getFriends = () => {
    const users = getAllUsers();
    return users.filter(u => (user.friends || []).includes(u.id));
  };

  const addTokens = (amount) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].eliteTokens = (users[userIndex].eliteTokens || 0) + amount;
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
      setUser({ ...user, eliteTokens: users[userIndex].eliteTokens });
    }
  };

  const useTokens = (amount) => {
    const users = JSON.parse(localStorage.getItem('eliteArrowsUsers') || '[]');
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex !== -1) {
      if ((users[userIndex].eliteTokens || 0) < amount) return false;
      users[userIndex].eliteTokens = (users[userIndex].eliteTokens || 0) - amount;
      localStorage.setItem('eliteArrowsUsers', JSON.stringify(users));
      setUser({ ...user, eliteTokens: users[userIndex].eliteTokens });
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signUp, 
      signIn, 
      signOut, 
      updateUser,
      addFriend,
      removeFriend,
      subscribe,
      requestAdminRole,
      getAllUsers,
      getFriends,
      addTokens,
      useTokens,
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}