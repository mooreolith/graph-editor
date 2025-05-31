import { basicSetup, EditorView } from    'codemirror';
import { EditorState, Compartment } from  '@codemirror/state';
import { keymap } from                    '@codemirror/view';
import { javascript } from                '@codemirror/lang-javascript';
import { markdown } from                  '@codemirror/lang-markdown';
import { indentWithTab } from             '@codemirror/commands';
import { marked } from                    'marked';
import { parser, walker } from            './lib/parser.js';
let language = new Compartment, tabSize = new Compartment;

const create = function(innerText){
  const temp = document.createElement( 'div' );
  temp.innerHTML = innerText;
  return temp.firstChild;
}

class Cell {
  notebook;
  #element;
  #editor;
  type = undefined;

  constructor(notebook, type){
    this.notebook = notebook;

    this.#element = create( `<section class="cell">
      <form class="cell-types">
        <input class="cell-type code" type="radio" name="cell-type" value="code" ${type === 'code' ? 'checked' : ''} />
        <label>Code</label>
        <input class="cell-type markdown" type="radio" name="cell-type" value="markdown" ${type === 'markdown' ? 'checked' : ''} />
        <label>Markdown</label>
      </form>
        <div class="input-container"></div>
        <span class="indicator"></span>

        <output class="messages"></output>
        <output class="output"></output>

        <div class="cell-buttons">
          <button class="cell-button run">Run</button>
          <button class="cell-button remove">Delete</button>
          <button class="cell-button prepend">Add Above</button>
          <button class="cell-button append">Add Below</button>
        </div>
      </section>` );

    this.qs( '.cell-button.run' ).addEventListener( 'click', this.run.bind( this ) );
    this.qs( '.cell-button.remove' ).addEventListener( 'click', this.remove.bind( this ) );
    this.qs( '.cell-button.prepend' ).addEventListener( 'click', this.prepend.bind( this) );
    this.qs( '.cell-button.append' ).addEventListener( 'click', this.append.bind( this ) );
    this.qs( '.cell-type.code' ).addEventListener( 'change', this.onCellTypeCodeClick.bind( this ) );
    this.qs( '.cell-type.markdown' ).addEventListener( 'change', this.onCellTypeMarkdownClick.bind( this ) );

    const cell = this;
    
    function CtrlEnter(){
      return keymap.of([{
        key: 'Ctrl-Enter',
        run(){
          cell.run();
          return true;
        }
      }]);
    }
    
    const extensions = [
      CtrlEnter(),
      basicSetup,
      keymap.of( [ indentWithTab ] ),
      language.of( type === 'code' ? javascript() : markdown() ),
      tabSize.of( EditorState.tabSize.of( 2 ) )
    ];

    if(type === 'markdown') extensions.push(EditorView.lineWrapping);
    const state = EditorState.create( { extensions } );
    
    this.#editor = new EditorView({ state, parent: this.qs('.input-container') });
  }

  get messages(){
    return [];
  }

  set messages(val){
    return;
  }

  clear(){}

  remove(){
    const index = this.notebook.cellsArr.indexOf(cell);
    this.notebook.cellsArr.splice( index, 1 );
    this.#element.remove();
  }

  prepend(){
    const index = this.notebook.cellsArr.indexOf( cell );
    const cell = new CodeCell( this.notebook );
    const before = index - 1 > 0 ? index - 1 : 0;
    this.notebook.cellsArr.splice( before, 0, cell );
    this.#element.before( cell.#element );
  }

  append(){
    const index = this.notebook.cellsArr.findIndex( cell => cell === this );
    const cell = new CodeCell( this.notebook );
    const after = index + 1;
    this.notebook.cellsArr.splice( after, 0, cell );
    this.#element.after( cell.#element );
  }

  onCellTypeCodeClick(){
    const cell = new CodeCell( this.notebook );
    const index = this.notebook.cellsArr.findIndex( cell => cell === this );
    cell.source = this.source;
    cell.output = '';
    cell.messages = [];
    this.notebook.cellsArr.splice( index, 1, cell );
    this.#element.replaceWith( cell.element );
  }

  onCellTypeMarkdownClick(){
    const cell = new MarkdownCell( this.notebook );
    const index = this.notebook.cellsArr.findIndex( cell => cell === this );
    cell.source = this.source;
    cell.output = '';
    cell.messages = [];
    this.notebook.cellsArr.splice( index, 1, cell );
    this.#element.replaceWith( cell.element );
  }

  get source(){
    return this.#editor.state.doc.toString();
  }

  set source(text){
    this.#editor.dispatch( {
      changes: {
        from: 0,
        to: this.#editor.state.doc.length,
        insert: text
      }
    } );
  }

  get element(){
    return this.#element;
  }

  qs(sel){
    return this.#element.querySelector( sel );
  }

  qsa(sel){
    return this.#element.querySelectorAll( sel );
  }
}

class CodeCell extends Cell {
  #execution_count = 0;
  type = 'code';

  constructor(notebook){
    super(notebook, 'code');
  }

  get messages(){
    return [ ...this.qsa( '.messages>.log' ) ].map( p => p.innerHTML )
  }

  set messages(msgs){
    msgs.forEach( msg => this.#log(msg) );
  }

  get output(){
    const output = this.qs( '.output' );
    return output.innerHTML;
  }

  set output(result){
    const output = this.qs( '.output' );

    if (result && (result instanceof HTMLElement)) {
      output.innerHTML = '';
      output.appendChild( result );
    } else if (typeof result === 'number') {
      output.innerText = result;
    } else if (typeof result === 'string') {
      output.innerText = result;
    } else if (typeof result === 'boolean') {
      output.innerText = result;
    } else if ((typeof result === 'object') || (typeof result === 'array')) {
      output.innerHTML = `<pre>${ JSON.stringify( result, null, 2 ) }</pre>`;
    } else if (result === null) {
      output.innerText = result;
    }
  }

  clear(){
    this.qs( '.messages' ).innerHTML = '';
    this.qs( '.output' ).innerHTML = '';
  }

  get element(){
    return super.element;
  }

  async run(){
    const cell = this.element;
    const messages = this.qs( '.messages' );
    const output = this.qs( '.output' );
    
    this.#execution_count += 1;

    const originalLog = console.log.bind( console );
    console.log = (...args) => { 
      this.#log( ...args ); 
      originalLog( ...args ); 
    };

    const originalError = console.error.bind( console );
    console.error = (...args) => {
      this.#error( ...args );
      originalError( ...args );
    }

    const originalDebug = console.debug.bind( console );
    console.debug = (...args) => {
      this.#debug( ...args );
      originalDebug( ...args);
    }

    messages.innerHTML = '';
    output.innerHTML = '';

    function scopedEval(code, context){
      const AsyncFunction = async function(){}.constructor;
      const func = new AsyncFunction( ...Object.keys( context ), `try {
        ${code}
      } catch(e) {
        console.error(e.message);
        console.error(e.stack);
      }` );
      return func( ...Object.values( context ) );
    }

    // start "running" animation
    const indicator = this.qs('.indicator');
    let i = 0;
    const states = ['...', ':..', '.:.', '..:'];
    const animation = setInterval(() => {
      indicator.innerText = states[i++ % states.length];
    }, 250);

    this.output = await scopedEval( this.source, { 
      // these variables are available in a cell
      cell: this, 
      output, 
      parser, 
      walker,
      ...this.notebook.context
    } );
    this.element.classList.remove('running');
    this.#execution_count = this.#execution_count === null ? 1 : this.#execution_count + 1;

    // stop "running" animation
    clearInterval(animation);
    indicator.innerText = '';

    console.log = originalLog.bind( console );
    console.error = originalError.bind( console );
    console.debug = originalDebug.bind( console );
  }

  remove(){
    super.remove();
  }

  #log(...args){
    const p = create(`<p class="log">${ args.join(' ') }</p>`);
    this.qs( '.messages' ).appendChild( p );
  }

  #error(...args){
    const p = create(`<p class="error">${ args.join( ' ' ) }</p>`);
    this.qs( '.messages' ).appendChild( p );
  }

  #debug(...args){
    const p = create(`<p class="debug">${ args.map( a => (typeof a === 'object') || (typeof a === 'array') ? JSON.stringify( a, null, 2 ) : a ).join( '  ' )  }</pre>`);
    this.qs( '.messages' ).appendChild( p );
  }

  toJSON(){
    return {
      "cell_type": "code",
      "execution_count": this.#execution_count,
      "metadata": {},
      "source": this.source,
      "outputs": [{
          "name": "stdout",
          "output_type": "stream",
          "text": this.messages
        }, {
          "data": {
            "text\/plain": this.output ?? ''
          },
          "execution_count": this.#execution_count,
          "metadata": {},
          "output_type": "execute_result"
        }
      ]
    }
  }

  static fromJSON(notebook, json){
    const cell = notebook.addCodeCell();
    cell.execution_count = json.execution_count;
    cell.source = json.source;
    cell.messages = json.outputs.filter( o => o.name === 'stdout' ).map( o => o.text );
    cell.output = json.outputs
      .filter( o => o.output_type === "execute_result" )[ 0 ]
      ?.data?.[ "text/plain" ];
    return cell;
  }
}

class MarkdownCell extends Cell {
  #element;
  #editor;
  type = "markdown";

  constructor(notebook){
    super(notebook, 'markdown');
  }

  run(){
    const html = marked.parse( this.source );

    const input = super.qs( '.input-container' );
    const output = super.qs( '.output' );

    // const previous = input.style.display;
    input.style.display = 'none';
    output.innerHTML = html

    output.addEventListener( 'dblclick', () => {
      output.innerHTML = '';
      input.style.display = 'inline';
    })
  }

  remove(){
    super.remove();
  }

  toJSON(){
    return {
      "cell_type": "markdown",
      "metadata": {},
      "source": this.source
    }
  }

  static fromJSON(notebook, json){
    const cell = notebook.addMarkdownCell();
    cell.source = json.source;
    cell.run();
    return cell;
  }

  get element(){
    return super.element;
  }
}

class Notebook {
  #parent;
  #element;
  context;
  cellsArr = [];
  cellsEl;

  constructor(container, title, context = {}){
    this.#parent = container;
    this.#element = create( `<article class="notebook">
      <div class="notebook-inner">
        <h1 class="title" contenteditable="true">Notebook Title</h1>
        <ol class="cells"></ol>

        <div class="notebook-buttons">
          <button class="notebook-button run-all">Run All</button>
          <button class="notebook-button add-cell">Add Cell</button>
          <button class="notebook-button clear-outputs">Clear Outputs</button>
        </div>
      </div>
    </article>` );

    this.#parent.appendChild( this.#element );
    this.context = context;
    this.cellsEl = this.qs( '.cells' );
    this.title = title;
    
    // button click event handlers
    this.qs( '.notebook-button.run-all' ).addEventListener( 'click', this.runAll.bind( this ) );
    this.qs( '.notebook-button.add-cell' ).addEventListener( 'click', this.addCodeCell.bind( this ) );
    this.qs( '.notebook-button.clear-outputs' ).addEventListener( 'click', this.clearOutputs.bind( this ) );
  }

  close(){
    this.#element.remove();
  }

  async runAll(){
    for(let cell of this.cellsArr){
      await cell.run();
    }
  }

  addCodeCell(){
    const cell = new CodeCell( this );
    this.cellsArr.push( cell );
    this.cellsEl.appendChild( cell.element );
    return cell;
  }

  clearOutputs(){
    for(let cell of this.cellsArr){
      cell.clear();
    }
  }

  addMarkdownCell(){
    const cell = new MarkdownCell( this );
    this.cellsArr.push( cell );
    this.cellsEl.appendChild( cell.element );
    return cell;
  }

  get element(){
    return this.#element;
  }

  toJSON(){
    return {
      "metadata": {
        "kernelspec": {
          "display_name": "JavaScript",
          "language": "javascript",
          "name": "javascript"
        },
        "language_info": {
          "codemirror_mode": {
            "name": "javascript",
            "version": 6
          },
          "file_extension": ".js",
          "mimetype": "text/javascript",
          "name": "javascript",
          "nbconvert_exporter": "javascript"
        }
      },
      "nbformat": 4,
      "nbformat_minor": 2,
      "cells": this.cellsArr.map( cell => cell.toJSON() )
    }
  }

  static fromJSON(container, title, json, context ){
    const notebook = new Notebook( container, title, context );
    notebook.title = title;
    notebook.context = context;
    json.cells.forEach( json => {
      const CellType = json.cell_type === 'code' ? CodeCell : MarkdownCell;
      CellType.fromJSON( notebook, json );
    } );

    return notebook;
  }

  get title(){
    return this.qs( '.title' ).innerText;
  }

  set title(title){
    this.qs( '.title' ).innerText = title;
  }

  get element(){
    return this.#element;
  }

  qs(sel){
    return this.#element.querySelector( sel );
  }

  qsa(sel){
    return this.#element.querySelectorAll( sel );
  }
}

class App {
  #parent;
  #element;
  #notebook;
  context;

  constructor(container, context = {}){
    this.context = context;
    this.#parent = container;
    this.#element = create( `<div class="notebook-app">
        <div class="app-buttons">
          <label class="top-notebook-label">Notebook: </label>

          <button class="app-button run-all">Run All</button>
          <button class="app-button minimize">Minimize</button>
        </div>
        <input type="file" class="notebook-input" style="display: none;" />
        <a class="download-link" style="display: none;"></a>
        <div class="notebook-container"></div>
      </div>` );
    this.#parent.appendChild( this.#element );

    this.#notebook = new Notebook( this.#parent, "Notebook Title", this.context );
    this.#notebook.addCodeCell();

    // open file menu items
    this.qs( '.notebook-input'      ).addEventListener( 'change', this.onUploadChange.bind( this ) );
    this.qs( '.app-button.minimize' ).addEventListener( 'click',  this.onMinimizeClick.bind( this ) );
    this.qs( '.app-button.run-all'  ).addEventListener( 'click',  this.onRunAllClick.bind( this ) );

    // Open Notebook from URLParams
    const query = window.location.search;
    const searchParams = new URLSearchParams(query);
    
    if(searchParams.has('nburl')){
      this.#notebook?.close();
      const url = decodeURIComponent(searchParams.get('nburl'));
      this.fromURL(url);
    }
    if(searchParams.has(`nbls`)){
      this.#notebook?.close();
      const filename = decodeURIComponent(searchParams.get('nbls'));
      this.fromLocalStorage(filename);
    }
  }

  //#region close and clear
  /*
  close(){
    this.#notebook.close();
    this.#element.remove();
  }
  */

  clear(){
    this.#notebook?.close();
    this.#notebook = new Notebook( this.#parent, "Notebook Title", this.context);

    this.qs( '.notebook-input'      ).addEventListener( 'change', this.onUploadChange.bind( this ) );
    this.qs( '.app-button.minimize' ).addEventListener( 'click',  this.onMinimizeClick.bind( this ) );
    this.qs( '.app-button.run-all'  ).addEventListener( 'click',  this.onRunAllClick.bind( this ) );
  }
  //#endregion

  //#region to and fro
  fromJSON(title, json){
    this.#notebook?.close();
    this.#notebook = Notebook.fromJSON( 
      this.#parent,
      title,
      json, 
      this.context 
    );
  }

  toJSON(){
    return this.#notebook.toJSON()
  }

  async fromURL(url){
    const response = await fetch(url);
    if(!response.ok){
      console.error(`Error fetching ${url}`)
      return;
    }

    let title = url.split('/').at(-1).split('.').at(-2);
    const json = await response.json();
    title ??= json.title;
    this.fromJSON( title, json );
  }

  async toURL(url){
    if(this.#notebook){
      const title = this.#notebook.title;
      const notebook = this.#notebook.toJSON();

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': "application/x-ipynb+json" },
        body: JSON.stringify(notebook)
      });

      if(response.ok){
        alert( `${title} successfully sent to ${url}` );
      }else{
        alert( `Error: ${title} NOT successfully sent to ${url}` );
      }
    }
  }

  fromLocalStorage(title){
    const filename = title.endsWith('.ipynb') ? title : `${title}.ipynb`;
    title = title.endsWith('.ipynb') ? title.slice(0, title.length - '.ipynb'.length) : title;
    const json = JSON.parse( localStorage.getItem( filename ) );
    this.fromJSON( title, json )
  }

  toLocalStorage(){
    const title = this.#notebook.title;
    const filename = `${title}.ipynb`
    const json = this.#notebook.toJSON();
    localStorage.setItem(filename, json);
  }

  fromText(title, text){
    const json = JSON.parse(text);
    this.fromJSON(title, json);
  }

  toText(){
    const json = this.#notebook.toJSON();
    return JSON.stringify(json, null, 2);
  }
  //#endregion

  //#region getters and setters
  get element(){
    return this.#element;
  }

  get title(){
    return this.#notebook.title;
  }

  set title(val){
    this.#notebook.title = val;
  }

  //#endregion

  //#region various methods
  onUploadChange(e){
    const input = this.qs( '.notebook-input' );
    if(input.files.length) this.fromFile( input.files[0] );
  }

  fromFile(file){
    const title = file.name.slice(0, file.name.length - '.ipynb'.length);
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const json = JSON.parse( reader.result );
      this.#notebook = Notebook.fromJSON( this.qs( '.notebook-container' ), title, this.context );
    });

    reader.readAsText( file );
  }

  download(){
    if(!this.#notebook) return;
    const text = JSON.stringify( this.#notebook.toJSON() );
    const data = `data:application/x-ipynb+json;charset=utf-8,${encodeURIComponent(text)}`;
    const a = this.qs( '.download-link' );
    a.setAttribute( 'href', data );
    a.setAttribute( 'download', `${this.#notebook.title}.ipynb` );
    a.click();
  }

  onMinimizeClick(e){
    const elem = this.#notebook.element;
    const toggle = e.target;
    if(elem.classList.contains('minimized')){
      elem.classList.remove('minimized');
      toggle.innerText = 'Minimize';
    }else{
      elem.classList.add('minimized');
      toggle.innerText = 'Expand'
    }
  }

  onRunAllClick(e){
    if(this.#notebook) this.#notebook.runAll();
    else alert("No notebook opened");
  }

  qs(sel){
    return this.#element.querySelector( sel );
  }

  //#endregions
}

export { App }
