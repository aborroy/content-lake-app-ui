import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MARKED_OPTIONS, MarkdownModule, MarkedOptions, MarkedRenderer, provideMarkdown } from 'ngx-markdown';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDialogModule } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';

// App
import { AppComponent } from './app.component';
import { NavbarComponent } from './navbar/navbar.component';
import { AuthComponent } from './auth/auth.component';
import { SearchComponent } from './search/search.component';
import { ResultsComponent } from './results/results.component';
import { ChatComponent, DeleteSessionDialogComponent } from './chat/chat.component';
import { PermissionCompareComponent } from './permission-compare/permission-compare.component';
import { StatusComponent } from './status/status.component';
import { SourcesComponent } from './sources/sources.component';
import { AuthHttpInterceptor } from './interceptors/auth.interceptor';

/**
 * Links in a generated answer lead outside the application, so they open in a new tab.
 *
 * Positional arguments, not the object form: the `marked` bundled with ngx-markdown 18 still declares
 * `link(href, title, text)`. The object form compiles against newer majors and fails here.
 */
const renderer = new MarkedRenderer();
renderer.link = (href: string, title: string, text: string): string =>
  `<a href="${href}" target="_blank" rel="noopener noreferrer" title="${title || ''}">${text}</a>`;
const markedOptions: MarkedOptions = { renderer };

const routes: Routes = [
  { path: 'login',  component: AuthComponent },
  { path: 'search', component: SearchComponent },
  { path: 'chat',   component: ChatComponent },
  { path: 'status', component: StatusComponent },
  { path: 'sources', component: SourcesComponent },
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    AuthComponent,
    SearchComponent,
    ResultsComponent,
    ChatComponent,
    DeleteSessionDialogComponent,
    PermissionCompareComponent,
    StatusComponent,
    SourcesComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    RouterModule.forRoot(routes),
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatExpansionModule,
    MatDialogModule,
    MatCheckboxModule,
    MarkdownModule
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthHttpInterceptor, multi: true },
    // Generated answers are markdown. A link in one points outside the app, so it opens in a new tab
    // rather than replacing the view.
    provideMarkdown({
      markedOptions: {
        provide: MARKED_OPTIONS,
        useValue: markedOptions
      }
    })
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}
