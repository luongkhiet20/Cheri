import { Component, Output, Input, EventEmitter, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { EnvConfigurationService } from '../../services/env-configuration.service';
import { EditorComponent } from '@tinymce/tinymce-angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AsyncPipe } from '@angular/common';

@Component({
    selector: 'app-tiny-editor',
    templateUrl: './tiny-editor.component.html',
    styleUrls: ['./tiny-editor.component.css'],
    imports: [EditorComponent, ReactiveFormsModule, FormsModule, AsyncPipe]
})
export class TinyEditorComponent {
  editorApiKey$: Observable<string>;

  @Input() description = '';
  @Output() editorContentChange = new EventEmitter();

  constructor() {
    const envConfigurationService = inject(EnvConfigurationService);

    this.editorApiKey$ = envConfigurationService.getConfigType$('FE_TINYMCE_API_KEY');
  }

  onEditorChange(value): void {
    this.editorContentChange.emit(value);
  }


}
