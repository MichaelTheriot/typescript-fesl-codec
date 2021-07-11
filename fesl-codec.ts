// TODO: implement character escapes

export const enum FESLMessageType {
    SingleClient = 0xc0,
    SingleServer = 0x80,
    MultiClient  = 0xf0,
    MultiServer  = 0xb0
}

export const enum FESLMessageError {
    ExpectedDelimiter,
    ExpectedUtf8,
    InvalidCommandLength,
    InvalidType
}

const enum FESLMessageDelimiter {
    Separator  = 0x3d, // =
    Terminator = 0x0a  // \n
}

export class FESLMessage {
    #dataView: DataView;

    private constructor(data: ArrayBuffer) {
        this.#dataView = new DataView(data);
    }

    getCmd(): string {
        return String.fromCharCode(this.#dataView.getUint8(0))
            + String.fromCharCode(this.#dataView.getUint8(1))
            + String.fromCharCode(this.#dataView.getUint8(2))
            + String.fromCharCode(this.#dataView.getUint8(3))
    }

    getType(): FESLMessageType {
        return this.#dataView.getUint8(4);
    }

    getID() {
        return this.#dataView.getUint32(4) & 0x00ffffff;
    }

    *[Symbol.iterator]() {
        let p = 12;
        let c: number;
        try {
            while (p < this.#dataView.byteLength - 1) {
                let key = '';
                while ((c = this.#dataView.getUint8(p++)) !== FESLMessageDelimiter.Separator) key += String.fromCharCode(c);
                let value = '';
                while ((c = this.#dataView.getUint8(p++)) !== FESLMessageDelimiter.Terminator) value += String.fromCharCode(c);
                yield [key, value];
            }
        } catch (e) {
            if (e instanceof RangeError) {
                throw new TypeError('Expected delimiter');
            } else {
                throw e;
            }
        }
    }
}

export class FESLMessageBuilder {
    #cmd: string;
    #typeAndID: number;
    #length: number;
    #buffer: [string, string][]

    constructor(cmd: string, feslType: FESLMessageType, id: number) {
        if (cmd.length != 4) {
            throw new TypeError("FESLMessageBuilder cmd must be a 4 character string");
        }

        this.#cmd = cmd;
        this.#typeAndID = (((feslType as number) & 0xf0) << 24) | (id & 0xffffffff);
        this.#length = 13;
        this.#buffer = [];
    }

    push(key: string, value: string) {
        this.#length += key.length + 1 + value.length + 1;
        this.#buffer.push([key, value]);
    }

    build() {
        const buffer = new ArrayBuffer(this.#length);
        const dv = new DataView(buffer);
        let p = 0;
        for (let i = p; i < 4; i++) dv.setUint8(i, this.#cmd.charCodeAt(i));
        dv.setUint32(p += 4, this.#typeAndID);
        dv.setUint32(p += 4, this.#length);
        p += 4;
        for (const [key, value] of this.#buffer) {
            for (let i = 0; i < key.length; i++) dv.setUint8(p + i, key.charCodeAt(i));
            p += key.length;
            dv.setUint8(p++, FESLMessageDelimiter.Separator);
            for (let i = 0; i < value.length; i++) dv.setUint8(p + i, value.charCodeAt(i));
            p += value.length;
            dv.setUint8(p++, FESLMessageDelimiter.Terminator);
        }
        return buffer;
    }
}
