import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-admin-search',
  standalone: false,
  templateUrl: './admin-search.component.html',
  styleUrls: ['./admin-search.component.css']
})
export class AdminSearchComponent implements OnInit, OnDestroy {
  @Input() placeholder: string = 'Tìm kiếm...';
  @Input() value: string = '';
  @Input() loading: boolean = false;
  @Input() debounceMs: number = 300;

  @Output() valueChange = new EventEmitter<string>();
  @Output() search = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();

  private inputSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.inputSubject.pipe(
      debounceTime(this.debounceMs),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(val => {
      this.valueChange.emit(val);
      this.search.emit(val);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.inputSubject.next(val);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.search.emit(this.value);
  }

  onClear(): void {
    this.value = '';
    this.valueChange.emit('');
    this.search.emit('');
    this.cleared.emit();
  }
}
