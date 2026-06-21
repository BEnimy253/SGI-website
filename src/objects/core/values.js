const ACCOUNT_STATUSES = new Set(["active", "block"]);
const COURSE_STATUSES = new Set(["planned", "open", "closed"]);
const GENDERS = new Set(["male", "female", "other"]);
const CONTRACT_TYPES = new Set(["permanent", "visiting"]);
const TERM_TYPES = new Set(["regular", "supplementary"]);
const ATTENDANCE_STATUSES = new Set([
    "present",
    "absent",
    "excused",
    "late",
]);

export class Values {
    #http;

    constructor(http) {
        this.#http = http;
    }

    parseId(value, fieldName = "ID") {
        return this.parseInteger(value, fieldName, 1);
    }

    parseOptionalId(value, fieldName = "ID") {
        if (value === undefined || value === null || value === "") {
            return null;
        }
        return this.parseId(value, fieldName);
    }

    parseInteger(value, fieldName, minimum = 0, maximum = 2200) {
        const number = Number(value);
        if (
            !Number.isInteger(number) ||
            number < minimum ||
            number > maximum
        ) {
            throw this.#http.createError(400, `${fieldName} không hợp lệ.`);
        }
        return number;
    }

    parseNumber(value, fieldName, minimum = 0) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < minimum) {
            throw this.#http.createError(400, `${fieldName} không hợp lệ.`);
        }
        return number;
    }

    requiredText(value, fieldName) {
        const text = String(value ?? "").trim();
        if (!text) {
            throw this.#http.createError(
                400,
                `${fieldName} không được để trống.`,
            );
        }
        return text;
    }

    optionalText(value) {
        const text = String(value ?? "").trim();
        return text || null;
    }

    optionalDate(value) {
        const text = String(value ?? "").trim();
        return text || null;
    }

    parseScore(value, fieldName) {
        if (value === undefined || value === null || value === "") {
            return null;
        }
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0 || number > 10) {
            throw this.#http.createError(
                400,
                `${fieldName} phải từ 0 đến 10.`,
            );
        }
        return Number(number.toFixed(1));
    }

    parseAccountStatus(value) {
        return this.#parseEnum(
            value ?? "active",
            ACCOUNT_STATUSES,
            "Trạng thái tài khoản",
        );
    }

    parseCourseStatus(value) {
        return this.#parseEnum(
            value ?? "planned",
            COURSE_STATUSES,
            "Trạng thái môn học",
        );
    }

    parseGender(value) {
        return this.#parseEnum(value, GENDERS, "Giới tính");
    }

    parseContractType(value) {
        return this.#parseEnum(
            value,
            CONTRACT_TYPES,
            "Loại hợp đồng",
        );
    }

    parseTermType(value) {
        return this.#parseEnum(
            value ?? "regular",
            TERM_TYPES,
            "Loại học kỳ",
        );
    }

    parseAttendanceStatus(value) {
        return this.#parseEnum(
            value,
            ATTENDANCE_STATUSES,
            "Trạng thái điểm danh",
        );
    }

    #parseEnum(value, allowedValues, fieldName) {
        const text = String(value ?? "").trim();
        if (!allowedValues.has(text)) {
            throw this.#http.createError(400, `${fieldName} không hợp lệ.`);
        }
        return text;
    }
}
