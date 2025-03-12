// Configuration Variables
export const clientId = "1uh3r35aemfub1ee1lin6o8lb1";
export const cognitoDomain = "https://us-east-1yk7q60v8o.auth.us-east-1.amazoncognito.com";
export const redirectUri = "https://main.d1lgse8ryp3x19.amplifyapp.com/index.html";
const tokenEndpoint = `${cognitoDomain}/oauth2/token`;

export function decodeToken(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  
    return JSON.parse(jsonPayload);
  }
/**
 * Exchanges authorization code for tokens
 */
export async function exchangeCodeForTokens(authCode) {
  console.log('Starting token exchange with code:', authCode);
  
  // Clear any existing tokens
  localStorage.removeItem("accessToken");
  localStorage.removeItem("idToken");
  localStorage.removeItem("refreshToken");
  
  // Clean URL by removing the code
  const cleanUrl = window.location.href.split('?')[0];
  window.history.replaceState({}, document.title, cleanUrl);

  try {
      const response = await fetch(tokenEndpoint, {
          method: "POST",
          headers: {
              "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: clientId,
              code: authCode,
              redirect_uri: redirectUri,
              scope: "aws.cognito.signin.user.admin email openid profile",
          }).toString()
      });

      if (!response.ok) {
          const errorData = await response.json();
          console.error('Token exchange error:', errorData);
          throw new Error(`Token exchange failed: ${JSON.stringify(errorData)}`);
      }

      const tokens = await response.json();
      console.log('Tokens received successfully');
      
      // Store tokens in localStorage
      localStorage.setItem("accessToken", tokens.access_token);
      localStorage.setItem("idToken", tokens.id_token);
      localStorage.setItem("refreshToken", tokens.refresh_token);

      return decodeToken(tokens.id_token);
  } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
  }
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser() {
    const idToken = localStorage.getItem("idToken");
    if (!idToken) {
        console.log("No ID token found in localStorage.");
        return null;
    }
    try {
        const user = decodeToken(idToken);
        // Check token expiration
        const now = Math.floor(Date.now() / 1000);
        if (user.exp < now) {
            console.log("ID token has expired. Redirecting to login.");
            redirectToLogin();
            return null;
        }
        console.log("Current user:", user);
        return user;
    } catch (error) {
        console.error("Error getting current user:", error);
        return null;
    }
}

/**
 * Redirect to login page
 */
export function redirectToLogin() {
    window.location.href = 'auth.html';
}

/**
 * Handle user logout
 */
export function logoutUser() {
    // Clear tokens
    localStorage.removeItem("accessToken");
    localStorage.removeItem("idToken");
    localStorage.removeItem("refreshToken");
    
    // Redirect to Cognito logout URL
    const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent('https://main.d1lgse8ryp3x19.amplifyapp.com/auth.html')}`;
    window.location.href = logoutUrl;
}
