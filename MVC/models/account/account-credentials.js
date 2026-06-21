import bcrypt from "bcryptjs";

export class AccountCredentials {
    #values;

    constructor(http, values) {
        this.#values = values;
    }

    async create(client, role, body) {
        const result = await client.query(
            `
            insert into public.accounts (
                username,
                password_hash,
                role,
                status
            )
            values ($1, $2, $3, $4)
            returning id
            `,
            [
                this.#values.requiredText(body.username, "Tên tài khoản"),
                await bcrypt.hash(
                    this.#values.requiredText(body.password, "Mật khẩu"),
                    12,
                ),
                role,
                this.#values.parseAccountStatus(body.status),
            ],
        );
        return result.rows[0].id;
    }

    async update(client, accountId, body) {
        const password = this.#values.optionalText(body.password);
        const passwordHash = password
            ? await bcrypt.hash(password, 12)
            : null;

        const result = await client.query(
            `
            update public.accounts
            set
                username = $1,
                status = $2,
                password_hash = coalesce($3, password_hash)
            where id = $4
            returning id
            `,
            [
                this.#values.requiredText(body.username, "Tên tài khoản"),
                this.#values.parseAccountStatus(body.status),
                passwordHash,
                accountId,
            ],
        );
        return result.rows[0] ?? null;
    }

    async createPerson(client, accountId, body) {
        await client.query(
            `
            insert into public.people (
                account_id,
                family_name,
                given_name,
                date_of_birth,
                gender,
                phone,
                email
            )
            values ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
                accountId,
                this.#values.requiredText(body.familyName, "Họ và tên lót"),
                this.#values.requiredText(body.givenName, "Tên"),
                this.#values.requiredText(body.dateOfBirth, "Ngày sinh"),
                this.#values.parseGender(body.gender),
                this.#values.optionalText(body.phone),
                this.#values.optionalText(body.email),
            ],
        );
    }

    async updatePerson(client, accountId, body) {
        await client.query(
            `
            update public.people
            set
                family_name = $1,
                given_name = $2,
                date_of_birth = $3,
                gender = $4,
                phone = $5,
                email = $6
            where account_id = $7
            `,
            [
                this.#values.requiredText(body.familyName, "Họ và tên lót"),
                this.#values.requiredText(body.givenName, "Tên"),
                this.#values.requiredText(body.dateOfBirth, "Ngày sinh"),
                this.#values.parseGender(body.gender),
                this.#values.optionalText(body.phone),
                this.#values.optionalText(body.email),
                accountId,
            ],
        );
    }
}
