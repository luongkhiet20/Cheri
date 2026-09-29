import { toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Component, inject } from '@angular/core';
import { Observable, BehaviorSubject, from } from 'rxjs';
import { delay, take } from 'rxjs/operators';

import { languages } from '../../shared/constants';
import { Page } from '../../shared/models';
import { SignalStoreSelectors } from '../../store/signal.store.selectors';
import { SignalStore } from '../../store/signal.store';
import { MatFormField, MatLabel, MatSelect, MatOption } from '@angular/material/select';
import { MatInput } from '@angular/material/input';
import { MatButton } from '@angular/material/button';
import { TinyEditorComponent } from '../tiny-editor.ts/tiny-editor.component';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-pages-edit',
    templateUrl: './pages-edit.component.html',
    styleUrls: ['./pages-edit.component.css'],
    imports: [MatFormField, MatLabel, MatInput, ReactiveFormsModule, FormsModule, MatButton, MatSelect, MatOption, TinyEditorComponent, AsyncPipe]
})
export class PagesEditComponent {
  private store = inject(SignalStore);
  private selectors = inject(SignalStoreSelectors);
  private fb = inject(FormBuilder);

  pages$: Observable<Page[]>;
  pagesEditForm: FormGroup;
  languageOptions = languages;
  choosenLanguageSub$ = new BehaviorSubject(languages[0]);
  newPage = '';
  chosenPage = '';
  sendRequest = false;

  constructor() {
    this.store.getPages();

    this.pagesEditForm = this.fb.group({
      titleUrl: ['', Validators.required],
      ...this.createLangForm(this.languageOptions),
    });

    this.pages$ = toObservable(this.selectors.pages);
  }

  onPageEditorChange(content, lang: string): void {
    this.pagesEditForm.get(lang).get('contentHTML').setValue(content);
  }

  addPage(): void {
    if (this.newPage) {
      this.pagesEditForm.get('titleUrl').setValue(this.newPage);
      this.languageOptions.forEach((lang) => {
        this.pagesEditForm.get(lang).get('title').setValue(this.newPage);
      });
    }
  }

  chosePage(): void {
    if (this.chosenPage) {
      this.pagesEditForm.get('titleUrl').setValue(this.chosenPage);
      this.pages$.pipe(take(1)).subscribe((pages) => {
        const foundPage = pages.find((page) => page.titleUrl === this.chosenPage);
        if (foundPage) {
          this.languageOptions.forEach((lang) => {
            this.pagesEditForm.get(lang).get('title').setValue(foundPage[lang]?.title || '');
            this.pagesEditForm.get(lang).get('contentHTML').setValue(foundPage[lang]?.contentHTML || '');
          });
        }
      });
    }
  }

  setLang(lang: string): void {
    this.choosenLanguageSub$.next('');
    from(lang)
      .pipe(delay(100))
      .subscribe(() => {
        this.choosenLanguageSub$.next(lang);
      });
  }

  savePage(): void {
    const request = this.pagesEditForm.value;
    this.store.addOrEditPage(request);
    this.sendRequest = true;
  }

  removePage(): void {
    this.store.removePage(this.chosenPage);
    this.sendRequest = true;
  }

  private createLangForm(languageOptions: Array<string>) {
    return languageOptions
      .map((lang: string) => ({
        [lang]: this.fb.group({
          title: '',
          contentHTML: '',
        }),
      }))
      .reduce((prev, curr) => ({ ...prev, ...curr }), {});
  }
}
