export class Http {
    createError(status, message) {
        const error = new Error(message);
        error.status = status;
        return error;
    }

    errorHandler = (error, req, res, next) => {
        if (res.headersSent) {
            next(error);
            return;
        }

        const databaseStatus = this.#databaseStatus(error.code);
        const status = error.status || databaseStatus || 500;
        const message = status === 500
            ? "Có lỗi xảy ra trong hệ thống."
            : error.message;

        if (status === 500) {
            console.error(error);
        }

        if (req.path.startsWith("/api/")) {
            res.status(status).json({ message });
            return;
        }

        res.status(status).send(message);
    }

    #databaseStatus(code) {
        if (code === "23505" || code === "23503") {
            return 409;
        }
        if (
            code === "P0001" ||
            String(code ?? "").startsWith("22") ||
            String(code ?? "").startsWith("23")
        ) {
            return 400;
        }
        return null;
    }
}
