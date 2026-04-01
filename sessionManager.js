// ==========================================
// SESSION MANAGEMENT UTILITY
// ==========================================
// This file handles user session tracking across all pages
// Include this in every HTML page with: <script src="/sessionManager.js"></script>

const SessionManager = {
  // Store user data in localStorage
  setUser(userType, userData) {
    const sessionData = {
      userType: userType, // 'customer' or 'employee'
      ...userData,
      loginTime: new Date().getTime()
    };
    localStorage.setItem('userSession', JSON.stringify(sessionData));
    console.log(`User session set: ${userType}`, sessionData);
  },

  // Get current user session
  getUser() {
    const session = localStorage.getItem('userSession');
    return session ? JSON.parse(session) : null;
  },

  // Check if user is logged in
  isLoggedIn() {
    return this.getUser() !== null;
  },

  // Get user type (customer or employee)
  getUserType() {
    const user = this.getUser();
    return user ? user.userType : null;
  },

  // Get user ID
  getUserId() {
    const user = this.getUser();
    if (user.userType === 'customer') {
      return user.userId;
    } else if (user.userType === 'employee') {
      return user.employeeId;
    }
    return null;
  },

  // Get user name
  getUserName() {
    const user = this.getUser();
    if (user.userType === 'customer') {
      return user.username;
    } else if (user.userType === 'employee') {
      return `${user.firstName} ${user.lastName}`;
    }
    return 'Unknown User';
  },

  // Clear session (logout)
  clearSession() {
    localStorage.removeItem('userSession');
    console.log('User session cleared');
  },

  // Redirect to login if not logged in (useful for protected pages)
  requireLogin(redirectToLogin = true) {
    if (!this.isLoggedIn()) {
      if (redirectToLogin) {
        window.location.href = '/index.html';
      }
      return false;
    }
    return true;
  },

  // Redirect to login if wrong user type
  requireUserType(requiredType) {
    const userType = this.getUserType();
    if (userType !== requiredType) {
      console.error(`Access denied. Required: ${requiredType}, Got: ${userType}`);
      window.location.href = '/index.html';
      return false;
    }
    return true;
  }
};

// Example usage:
// After successful login API call:
// SessionManager.setUser('customer', { userId: 123, username: 'john_doe' });
// 
// To check current user anywhere:
// const user = SessionManager.getUser();
// if (user) console.log(`Logged in as ${user.username}`);
//
// To logout:
// SessionManager.clearSession();
