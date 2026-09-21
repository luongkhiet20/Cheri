import { Document } from 'mongoose';
import { CartModel } from '../../cart/models/cart.model';

export interface User extends Document {
    _id: string;
    email: string;
    password?           : string;
    name?               : string;
    fullName?           : string;
    phoneNumber?        : string;
    address?            : string;
    gender?             : string;
    dateOfBirth?        : string;
    avatar?             : string;
    salt?               : string;
    cart?               : CartModel;
    images?             : string[];
    roles?              : string[];
    googleId?           : string;
    status?             : boolean;
    description?        : string;
    dateAdded?          : Date;
    createdAt?          : Date;
    updatedAt?          : Date;
    __v?                : number;
}
