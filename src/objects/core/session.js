import session from "express-session";

export class Session {
    register(app) {
        app.use(
            session({
                secret:
                    process.env.SESSION_SECRET ||
                    "sgi-development-session-secret",
                resave: false,
                saveUninitialized: false,
                cookie: {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                    maxAge: 1000 * 60 * 30,
                },
            }),
        );
    }
}
