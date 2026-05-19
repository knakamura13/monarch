import { betterAuth } from 'better-auth';
import { passkey } from '@better-auth/passkey';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { ENV } from './env';
import { dynamoBetterAuthAdapter } from './better-auth/dynamo-adapter';
import { Resend } from 'resend';

const resend = ENV.RESEND_API_KEY ? new Resend(ENV.RESEND_API_KEY) : null;

export const auth = betterAuth({
    appName: ENV.PUBLIC_APP_NAME,
    baseURL: ENV.BETTER_AUTH_URL,
    secret: ENV.BETTER_AUTH_SECRET,
    database: dynamoBetterAuthAdapter(),
    session: {
        expiresIn: 60 * 60 * 24 * 7,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5
        }
    },
    advanced: {
        cookiePrefix: 'pct',
        useSecureCookies: ENV.NODE_ENV === 'production'
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 8,
        maxPasswordLength: 256,
        autoSignIn: true,
        sendResetPassword: async ({ user, url }) => {
            if (!resend) {
                console.error('Resend API key not configured, cannot send reset password email');
                return;
            }
            try {
                await resend.emails.send({
                    from: 'Monarch <onboarding@resend.dev>',
                    to: user.email,
                    subject: 'Reset your password',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2>Reset your password</h2>
                            <p>Hi ${user.name || 'there'},</p>
                            <p>We received a request to reset your password for your Monarch account. Click the button below to proceed:</p>
                            <div style="margin: 32px 0;">
                                <a href="${url}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
                            </div>
                            <p>If you didn't request this, you can safely ignore this email.</p>
                            <p>Best,<br>The Monarch Team</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
                            <p style="font-size: 12px; color: #666;">If you're having trouble clicking the button, copy and paste this URL into your browser:</p>
                            <p style="font-size: 12px; color: #666; word-break: break-all;">${url}</p>
                        </div>
                    `
                });
            } catch (error) {
                console.error('Failed to send reset password email:', error);
            }
        }
    },
    rateLimit: {
        enabled: true,
        window: 60,
        max: 30
    },
    plugins: [
        passkey({
            rpID: new URL(ENV.BETTER_AUTH_URL).hostname,
            rpName: ENV.PUBLIC_APP_NAME,
            origin: new URL(ENV.BETTER_AUTH_URL).origin
        }),
        twoFactor({
            issuer: ENV.PUBLIC_APP_NAME,
            skipVerificationOnEnable: false
        })
    ],
    trustedOrigins: [ENV.APP_URL, ENV.BETTER_AUTH_URL]
});

export type Auth = typeof auth;
