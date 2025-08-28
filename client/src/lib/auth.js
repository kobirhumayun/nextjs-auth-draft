import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

/**
 * Decodes a JWT to get its expiration time.
 * Uses the universal atob() function for compatibility in all JS runtimes.
 * @param {string} token - The JWT token.
 * @returns {number|null} - The expiration timestamp in milliseconds or null if decoding fails.
 */
const getJwtExpiration = (token) => {
    try {
        const payloadBase64 = token.split('.')[1];
        const decodedJson = atob(payloadBase64);
        const decoded = JSON.parse(decodedJson);
        return decoded.exp * 1000;
    } catch (error) {
        console.error("Failed to decode JWT:", error);
        return null;
    }
};

/**
 * Refreshes the access token using the refresh token.
 * @param {object} token - The token object from the JWT callback.
 * @returns {object} - The updated token object with new tokens or an error flag.
 */
async function refreshAccessToken(token) {
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/refresh-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refreshToken: token.refreshToken,
            }),
            cache: 'no-store'
        });

        const refreshedTokens = await res.json();

        if (!res.ok) {
            throw refreshedTokens;
        }

        const newAccessTokenExpires = getJwtExpiration(refreshedTokens.accessToken);

        return {
            ...token, // Persist previous token properties
            accessToken: refreshedTokens.accessToken,
            accessTokenExpires: newAccessTokenExpires,
            // The backend provides a new refresh token for rotation
            refreshToken: refreshedTokens.refreshToken,
        };
    } catch (error) {
        console.error('Error refreshing access token:', error);
        return {
            ...token,
            error: 'RefreshAccessTokenError', // Flag the error for the client
        };
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                identifier: { label: 'Username or Email', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials.identifier || !credentials.password) {
                    return null;
                }

                try {
                    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            identifier: credentials.identifier,
                            password: credentials.password,
                        }),
                    });

                    const data = await res.json();

                    if (!res.ok) {
                        throw new Error(data.message || 'Authentication failed!');
                    }

                    const { user, accessToken, refreshToken } = data;

                    if (user && accessToken && refreshToken) {
                        return { ...user, accessToken, refreshToken };
                    }
                    return null;
                } catch (error) {
                    console.error("Authorize Error:", error.message);
                    throw error;
                }
            },
        }),
    ],
    callbacks: {
        /**
         * This callback is called whenever a JWT is created or updated.
         * It handles the token refresh logic.
         */
        async jwt({ token, user }) {
            // Initial sign-in
            if (user) {
                const accessTokenExpires = getJwtExpiration(user.accessToken);
                return {
                    ...token,
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    accessToken: user.accessToken,
                    accessTokenExpires,
                    refreshToken: user.refreshToken,
                };
            }

            // Add a buffer (e.g., 60 seconds) to refresh the token before it actually expires.
            // This helps prevent requests from failing at the exact moment of expiration.
            const bufferForRefresh = 5 * 1000; // 60 seconds in milliseconds

            // If the access token has not expired (and is not within the buffer time), return it.
            console.log("##############", token.accessTokenExpires)
            if (Date.now() < (token.accessTokenExpires - bufferForRefresh)) {
                return token;
            }

            // If the access token has expired or is about to, try to refresh it.
            console.log('Access token expired or will expire soon, refreshing...');
            return refreshAccessToken(token);
        },

        /**
         * This callback is called whenever a session is checked.
         * It passes custom data from the token to the client-side session object.
         */
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id;
                session.user.username = token.username;
                session.user.email = token.email;
                session.user.role = token.role;
                session.accessToken = token.accessToken;
                session.error = token.error; // Expose the error state to the client
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
});