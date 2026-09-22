import * as mongoose from 'mongoose';
const { Schema } = mongoose;

const UserSchema = new Schema({
    googleId        : String,
    email           : String,
    password        : String,
    name            : String,
    fullName        : String,
    phoneNumber     : { type: String, default: '' },
    address         : { type: String, default: '' },
    gender          : String,
    dateOfBirth     : String,
    avatar          : String,
    salt            : String,
    cart            : { type: Schema.Types.Mixed, default: {items: []} },
    images          : [],
    roles           : [],
    status          : { type: Boolean, default: true },
    description     : String,
    dateAdded       : { type: Date, default: Date.now },
}, { timestamps: true });

export default UserSchema;
