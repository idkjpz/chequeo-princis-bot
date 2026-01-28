const Auth = {
    getToken() {
        return localStorage.getItem('authToken');
    },

    saveToken(token) {
        localStorage.getItem('chatUserName'); // Keep as is if already set
        localStorage.setItem('authToken', token);
    },

    getUser() {
        const user = localStorage.getItem('authUser');
        return user ? JSON.parse(user) : null;
    },

    saveUser(user) {
        localStorage.setItem('authUser', JSON.stringify(user));
        // Also update chat user name for consistency
        localStorage.setItem('chatUserName', user.username);
    },

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        window.location.href = '/login.html';
    },

    isAuthenticated() {
        return !!this.getToken();
    },

    async fetchWithAuth(url, options = {}) {
        const token = this.getToken();
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${token}`
        };

        // Only add Content-Type for non-FormData requests
        // FormData sets its own Content-Type with boundary
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            this.logout();
            throw new Error('Session expired');
        }

        return response;
    },

    checkAuth() {
        if (!this.isAuthenticated() && !window.location.pathname.includes('login.html')) {
            window.location.href = '/login.html';
        }
    }
};

// Auto-check on load
if (!window.location.pathname.includes('login.html')) {
    Auth.checkAuth();
}
