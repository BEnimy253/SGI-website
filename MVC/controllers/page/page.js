import path from "node:path";

export class Page {
    #htmlDirectory;
    #route;

    constructor(route, htmlDirectory) {
        this.#route = route;
        this.#htmlDirectory = htmlDirectory;
    }

    register(app) {
        app.get(this.#route.root, (req, res) => {
            if (req.session.userId) {
                res.redirect(this.#route.dashboard);
                return;
            }

            res.redirect(this.#route.login);
        });

        app.get(this.#route.login, (req, res) => {
            if (req.session.userId) {
                res.redirect(this.#route.dashboard);
                return;
            }

            res.sendFile(path.join(this.#htmlDirectory, "login.html"));
        });

        app.get(
            this.#route.dashboard,
            this.#route.requireLogin,
            (req, res) => {
                res.sendFile(
                    path.join(this.#htmlDirectory, "dashboard.html"),
                );
            },
        );
    }
}
