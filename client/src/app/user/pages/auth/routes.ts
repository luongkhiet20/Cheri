import { Routes } from "@angular/router";
import { SignInComponent } from "./signin/signin.component";
import { SignUpComponent } from "./signup/signup.component";

export const AUTH_ROUTER: Routes = [
  {
    path: '',
    component: SignInComponent
  },
  {
    path: 'signin',
    component: SignInComponent
  },
  {
    path: 'login',
    redirectTo: 'signin',
    pathMatch: 'full'
  },
  {
    path: 'signup',
    component: SignUpComponent
  },
  {
    path: 'register',
    redirectTo: 'signup',
    pathMatch: 'full'
  }
];
