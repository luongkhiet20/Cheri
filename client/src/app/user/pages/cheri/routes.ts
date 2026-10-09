import { Routes } from "@angular/router";
import { AboutComponent } from "./about/about.component";
import { PageComponent } from "./policies/page.component";

export const CHERI_ROUTER: Routes = [
  {
    path: 'about',
    component: AboutComponent
  },
  {
    path: 'contact',
    component: AboutComponent
  },
  {
    path: ':titleUrl',
    component: PageComponent
  }
];
