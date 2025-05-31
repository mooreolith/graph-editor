import { Graph, Constants } from './layout.mjs';
import { App as NotebookApp } from './notebook.mjs';

//#region utilities
const main = document.querySelector('main');

const qs = document.querySelector.bind(document);
const qsa = document.querySelectorAll.bind(document);

const create = function(innerText){
  const temp = document.createElement('div');
  temp.innerHTML = innerText;
  return temp.firstChild;
}

const wait = async function(delay){
  return new Promise((resolve, reject) => setTimeout(resolve, delay));
}
//#endregion

class App {
  //#region ui elements
  #ui = {
    main:                 qs('.main.content'),
    canvas:               qs('canvas'),
    graph:      new Graph(qs('.main.content')),
    notebook:   null,

    menu: {
      toggleGraph:        qs('#toggle-graph-menu'),
      graph:              qs('#graph-menu'),
      graphItems: {
        new:              qs('#open-graph-new'),
        fromBrowser:      qs('#open-graph-browser'),
        fromFile:         qs('#open-graph-file'),
        toBrowser:        qs('#save-graph-browser'),
        fromURL:          qs('#open-graph-url'),
        toFile:           qs('#save-graph-file'),
        toURL:            qs('#save-graph-url')
      },

      toggleNotebook:     qs('#toggle-notebook-menu'),
      notebook:           qs('#notebook-menu'),
      notebookItems: {
        new:              qs('#open-notebook-new'),
        fromBrowser:      qs('#open-notebook-browser'),
        toBrowser:        qs('#save-notebook-browser'),
        fromFile:         qs('#open-notebook-file'),
        toFile:           qs('#save-notebook-file'),
        fromURL:          qs('#open-notebook-url'),
        toURL:            qs('#save-notebook-url')
      },

      toggleVertex:       qs('#toggle-vertex-menu'),
      vertex:             qs('#vertex-menu'),
      vertexItems: {
        add:              qs('#vertices-add'),
        neighbor:         qs('#vertices-neighbor'),
        selectAll:        qs('#vertices-select-all'),
        remove:           qs('#vertices-remove'),
        connect:          qs('#vertices-connect'),
        cut:              qs('#vertices-cut'),
        copy:             qs('#vertices-copy'),
        paste:            qs('#vertices-paste'),
        color:            qs('#vertex-color'),
        selectionColor:   qs('#vertex-selection-color'),
        texture:          qs('#vertex-texture'),
        size:             qs('#vertex-size'),
        label:            qs('#vertex-label'),
        visible:          qs('#vertex-visible'),
        reset:            qs('#vertex-reset'),
        apply:            qs('#vertex-apply')
      }, 

      toggleConstants:    qs('#toggle-constants-menu'),
      constants:          qs('#constants-menu'),
      constantsItems: {
        k:                qs('#constants-k-item'),
        f0:               qs('#constants-f0-item'),
        dt:               qs('#constants-dt-item'),
        D:                qs('#constants-D-item'),
        epsilon:          qs('#constants-epsilon-item'),
        theta:            qs('#constants-theta-item'),
        innerDistance:    qs('#constants-inner-distance-item')
      },

      toggleBlank:        qs('#toggle-blank'),
      blank:              qs('#blank-menu')
    }
  }
  //#endregion

  //#region defaults and options
  #vertexDefaults = {
    color: 'cornflowerblue',
    selectionColor: 'orange',
    texture: null,
    size: 1.0,
    label: {text: '', fontSize: 12, color: 'white', backgroundColor: 'black'},
    selected: false,
    visible: true
  };

  #vertexOptions = Object.assign({}, this.#vertexDefaults);

  #edgeDefaults = {
    color: 0x00beef,
    strength: 1.0,
    label: null,
    arrow: null
  };

  #edgeOptions = Object.assign({}, this.#edgeDefaults);
  //#endregion

  //#region constructor
  constructor(){
    // accordion effect
    [...qsa('.toggle')].forEach(t => {
      t.addEventListener('click', (e) => {
        qsa('.toggleable').forEach(it => it.classList.remove('active'));
        qs(`#${e.target.id.slice(7)}`).classList.add('active');
      });
    });

    // notebook interface
    this.#ui.notebook = new NotebookApp(qs('#notebook-container', { graph: this.#ui.graph }));

    // setup handlers
    this.setupGraphMenuClickHandlers();
    this.setupNotebookMenuClickHandlers();
    this.setupVertexMenuClickHandlers();
    this.setupVertexOptionDefaults();
    this.setupUIConstants();

    this.#ui.main.addEventListener( 'dblclick', (e) => this.onDblClick(), false );
    document.body.addEventListener('keydown', this.onKeydown.bind(this));

    // set edit values to clicked vertex
    this.#ui.graph.canvas.addEventListener('vertex-click', (e) => {
      this.#ui.menu.vertexItems.color.value           = '#' + e.detail.color.toString(16);
      this.#ui.menu.vertexItems.texture.value         = e.detail.texture;
      this.#ui.menu.vertexItems.selectionColor.value  = '#' + e.detail.selectionColor.toString(16);
      this.#ui.menu.vertexItems.size.value            = e.detail.size;
      this.#ui.menu.vertexItems.label.value           = e.detail.label?.innerHTML ?? '';
      this.#ui.menu.vertexItems.visible.checked       = e.detail.visible;
    });

    this.loadURLParams();

    // Open Notebooks
    // (handled in NotebookApp constructor)

    // debug
    window.graph = this.#ui.graph;
  }

  onKeydown(e){
    if(document.activeElement !== document.body) return;
    
    if((e.ctrlKey || e.metaKey) && e.key === 'a'){
      e.preventDefault();
      this.onSelectAllClick();
    }
    
    if((e.ctrlKey || e.metaKey) && e.key === '/'){
      e.preventDefault();
      this.onConnectClick();
    }

    if((e.ctrlKey || e.metaKey) && e.key === 'x'){
      e.preventDefault();
      this.onCutClick();
    }

    // Ctrl+C or Cmd+C pressed?
    if ((e.ctrlKey || e.metaKey) && e.key === 'c'){
      e.preventDefault();
      this.onCopyClick();
    }

    // Backspace or Delete pressed
    if(e.key === 'Backspace' || e.key === 'Delete'){
      e.preventDefault();
      this.onRemoveVertexClick();
    }

    if(e.key === 'Space' || e.key === ' ' || e.keyCode === 32){
      e.preventDefault();
      this.onNewVertexClick();
    }

    // Ctrl+V or Cmd+V pressed?
    if ((e.ctrlKey || e.metaKey) && e.key === 'v'){
      e.preventDefault();
      this.onPasteClick();
    }
  }
  
  loadURLParams() {
    const query = window.location.search;
    const searchParams = new URLSearchParams(query);

    // Open Graphs
    if (searchParams.has('graphurl')) {
      this.#ui.graph.clear();
      const url = searchParams.get('graphurl');

      fetch(url).then(async (response) => {
        const text = await response.text();
        this.openGraph(text);
      });
    }

    if (searchParams.has('graphls')) {
      this.#ui.graph.clear();
      const filename = searchParams.get('graphls');
      this.#ui.notebook.qs('.app-button.minimize').click();
      this.openGraph(localStorage.getItem(filename));
    }
  }

  setupUIConstants() {
    this.#setupUIConstant('K');
    this.#setupUIConstant('f0');
    this.#setupUIConstant('dt');
    this.#setupUIConstant('D');
    this.#setupUIConstant('epsilon');
    this.#setupUIConstant('theta');
    this.#setupUIConstant('inner-distance');
  }

  setupVertexMenuClickHandlers() {
    this.#ui.menu.vertexItems.add.addEventListener('click', this.onNewVertexClick.bind(this));
    this.#ui.menu.vertexItems.neighbor.addEventListener('click', this.onNewNeighborClick.bind(this));
    this.#ui.menu.vertexItems.selectAll.addEventListener('click', this.onSelectAllClick.bind(this));
    this.#ui.menu.vertexItems.remove.addEventListener('click', this.onRemoveVertexClick.bind(this));
    this.#ui.menu.vertexItems.connect.addEventListener('click', this.onConnectClick.bind(this));
    this.#ui.menu.vertexItems.cut.addEventListener('click', this.onCutClick.bind(this));
    this.#ui.menu.vertexItems.copy.addEventListener('click', this.onCopyClick.bind(this));
    this.#ui.menu.vertexItems.paste.addEventListener('click', this.onPasteClick.bind(this));

    this.#ui.menu.vertexItems.color.addEventListener('input', (e) => this.onVertexColorChange(e));
    this.#ui.menu.vertexItems.selectionColor.addEventListener('input', (e) => this.onVertexSelectionColorChange(e));
    this.#ui.menu.vertexItems.texture.addEventListener('input', (e) => this.onVertexTextureChange(e));
    this.#ui.menu.vertexItems.size.addEventListener('input', (e) => this.onVertexSizeChange(e));
    this.#ui.menu.vertexItems.label.addEventListener('keyup', (e) => this.onVertexLabelChange(e));
    this.#ui.menu.vertexItems.visible.addEventListener('change', (e) => this.onVertexVisibleChange(e));
  }

  setupVertexOptionDefaults() {
    this.#ui.menu.vertexItems.color.value = this.#vertexDefaults.color;
    this.#ui.menu.vertexItems.selectionColor.value = this.#vertexDefaults.selectionColor;
    this.#ui.menu.vertexItems.size.value = this.#vertexDefaults.size;
    this.#ui.menu.vertexItems.label.value = this.#vertexDefaults.label.text;
    this.#ui.menu.vertexItems.visible.checked = this.#vertexDefaults.visible;
  }

  setupNotebookMenuClickHandlers() {
    this.#ui.menu.notebookItems.new.addEventListener('click', this.onOpenNotebookNewClick.bind(this));
    this.#ui.menu.notebookItems.fromBrowser.addEventListener('click', this.onOpenNotebookBrowserClick.bind(this));
    this.#ui.menu.notebookItems.fromFile.addEventListener('click', this.onOpenNotebookFileClick.bind(this));
    this.#ui.menu.notebookItems.fromURL.addEventListener('click', this.onOpenNotebookURLClick.bind(this));
    this.#ui.menu.notebookItems.toBrowser.addEventListener('click', this.onSaveNotebookBrowserClick.bind(this));
    this.#ui.menu.notebookItems.toFile.addEventListener('click', this.onSaveNotebookFileClick.bind(this));
    this.#ui.menu.notebookItems.toURL.addEventListener('click', this.onSaveNotebookURLClick.bind(this));
  }

  setupGraphMenuClickHandlers() {
    this.#ui.menu.graphItems.new.addEventListener('click', this.onOpenGraphNewClick.bind(this));
    this.#ui.menu.graphItems.fromBrowser.addEventListener('click', this.onOpenGraphBrowserClick.bind(this));
    this.#ui.menu.graphItems.fromFile.addEventListener('click', this.onOpenGraphFileClick.bind(this));
    this.#ui.menu.graphItems.fromURL.addEventListener('click', this.onOpenGraphURLClick.bind(this));
    this.#ui.menu.graphItems.toBrowser.addEventListener('click', this.onSaveGraphBrowserClick.bind(this));
    this.#ui.menu.graphItems.toFile.addEventListener('click', this.onSaveGraphFileClick.bind(this));
    this.#ui.menu.graphItems.toURL.addEventListener('click', this.onSaveGraphURLClick.bind(this));
  }

  //#endregion

  //#region graph menu
  onOpenGraphNewClick(){
    this.#ui.graph.clear();
  }

  onOpenGraphBrowserClick(){
    if(!this.#ui.graph){
      this.#ui.graph = new Graph(this.#ui.main);
    }

    let title = prompt("Graph Title:", localStorage.getItem('lastBrowserGraphTitle') ?? '');
    if(title) localStorage.setItem('lastBrowserGraphTitle', title);
    else return;

    if(!title.endsWith('.json')) title = `${title}.json`;
    this.#ui.notebook.qs('.app-button.minimize').click();
    this.openGraph(localStorage.getItem( title ));
  }

  onOpenGraphFileClick(){
    const input = qs('#upload');
    input.onchange = () => {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.openGraph(reader.result)
      }
      reader.readAsText(file);  
    }

    input.showPicker();
  }

  async onOpenGraphURLClick(){
    const url = prompt('URL:', localStorage.getItem('lastGraphURL'));
    if(url) localStorage.setItem('lastGraphURL', url);
    else return;

    const response = await fetch(url);
    if(!response.ok){
      console.error(`Error fetching ${url}`)
      return;
    }

    const text = await response.text();
    this.openGraph(text);
  }

  onSaveGraphBrowserClick(){
    let title = window.prompt( "Graph Title: ", localStorage.getItem('lastBrowserGraphTitle') ?? '');
    if(title) localStorage.setItem('lastBrowserGraphTitle', title);
    else return;

    if(!title.endsWith('.json')) title = `${title}.json`;

    const graph = this.#ui.graph.toJSON();
    localStorage.setItem( title, JSON.stringify( graph, null, 2 ) );
    alert(`Graph ${title} saved to Browser's LocalStorage`)
  }

  onSaveGraphFileClick(){
    let title = window.prompt( "Graph Title:", localStorage.getItem('lastFileGraphTitle') ?? '');
    if(title){
      if(!title.endsWith('.json')) title = `${title}.json`;
      localStorage.setItem('lastFileGraphTitle', title);
    }else{
      return;
    }

    const link = qs('#download');
    const graph = this.#ui.graph.toJSON();
    const data = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(graph, null, 2))}`;
    
    link.setAttribute( 'href', data );
    link.setAttribute( 'download', title );
    
    link.click();
  }

  async onSaveGraphURLClick(){
    const url = prompt( "Graph URL:", localStorage.getItem('lastGraphURL'));
    if(!url) return;
    localStorage.setItem('lastGraphURL', url);
    
    const graph = this.#ui.graph.toJSON();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graph)
    });
  
    if(response.ok){
      alert( `File successfully sent to ${url}` );
    }else{
      alert( `Error: File NOT successfully sent to ${url}` );
    }
  }
  //#endregion

  //#region notebook menu
  onOpenNotebookNewClick(){
    this.#ui.notebook.clear();
  }

  onOpenNotebookBrowserClick(){
    let title = prompt("Notebook Title:", localStorage.getItem('lastBrowserNotebookTitle') ?? '');
    if(title) localStorage.setItem('lastBrowserNotebookTitle', title);
    else return;
    if(!title.endsWith('.ipynb')) title = `${title}.ipynb`;

    this.#ui.notebook.fromLocalStorage(title);
  }

  onOpenNotebookFileClick(){
    const input = qs('#upload');
    input.onchange = () => {
      const file = input.files[0]
      const title = file.name.split('.').at(-2);

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result;
        this.#ui.notebook.fromText(title, text);
      }
      reader.readAsText(file);  
    }

    input.showPicker();
  }

  async onOpenNotebookURLClick(){
    const url = prompt("Notebool URL:", localStorage.getItem('lastNotebookURL') ?? '');
    if(url) localStorage.setItem('lastNotebookURL', url);
    else return;

    this.#ui.notebook.clear();
    this.#ui.notebook.fromURL(url);
  }

  onSaveNotebookBrowserClick(){
    try{
      const notebook = this.#ui.notebook.toJSON();
      let title = this.#ui.notebook.title;
      if(title) localStorage.setItem('lastBrowserNotebookTitle', title);
      else return prompt("Please give the notebook a title");
      if(!title.endsWith('.ipynb')) title = `${title}.ipynb`;
      localStorage.setItem( title, JSON.stringify( notebook, null, 2 ) );
      alert(`Notebook ${title} stored to localStorage`);
    }catch(e){
      alert(`Error: ${title} **not** stored to localStorage`);
    }
  }

  onSaveNotebookFileClick(){
    this.#ui.notebook.download();
  }

  async onSaveNotebookURLClick(){
    const url = prompt('Notebook (POST) URL', localStorage.getItem('lastNotebookURL') ?? '');
    if(!url) return;
    localStorage.setItem('lastNotebookURL', url);
    
    const title = this.#ui.notebook.title;
    const notebook = this.#ui.notebook.toJSON();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, notebook })
    })

    if(response.ok){
      alert(`Notebook ${title} successfully saved to server`);
    }else{
      alert(`Error: Notebook ${title} NOT saved to server`);
    }
  }
  //#endregion

  //#region double click new vertex
  async onDblClick(){
    const selection = [ ...this.#ui.graph.selected.values() ];

    if(selection.length){
      for(let sel of selection){
        await wait(10);
        const b = this.#ui.graph.addVertex( Object.assign({}, this.#ui.graph.defaults.vertex));
        this.#ui.graph.addEdge( sel.id, b.id, Object.assign({}, this.#ui.graph.defaults.edge));
      }
    }else{
      this.#ui.graph.addVertex( Object.assign({}, this.#ui.graph.defaults.vertex) );
    }
  }
  //#endregion

  //#region accessors
  get vertexOptions(){
    return this.#vertexOptions;
  }

  set vertexOptions(options){
    Object.assign( this.#vertexOptions, options );
  }

  get edgeOptions(){
    return this.#edgeOptions;
  }

  set edgeOptions(options){
    Object.assign( this.#edgeOptions, options );
  }
  //#endregion

  //#region graph menu handlers
  onGraphOpenClick(){
    if(!this.#ui.graph){
      this.#ui.graph = new Graph(this.#ui.main);
    }

    let name = prompt("Filename to open: ", localStorage.getItem('lastFilename') ?? '');
    if(!name.endsWith('.json')) name = `${name}.json`;
    this.openGraph(localStorage.getItem( name ));
  }

  async openGraph(text){
    this.#ui.graph.clear();
    const graph = JSON.parse(text);

    Constants.fromJSON(graph.constants);
    this.#vertexDefaults = graph.defaults.vertex;
    this.#edgeDefaults = graph.defaults.edge;

    for(let vertex of graph.V){
      await wait(10);
      this.#ui.graph.addVertex( vertex );
    }
    for(let edge of graph.E){
      await wait(10);
      this.#ui.graph.addEdge( edge.sourceId, edge.targetId, edge );
    }
  }

  onGraphCloseClick(){
    this.#ui.graph.clear();
    this.#ui.notebook.clear();
  }

  onGraphSaveClick(){
    let name = window.prompt( "Filename for the graph: " );

    const graph = this.#ui.graph.toJSON();

    if(name){
      if(!name.endsWith('.json')) name = `${name}.json`;
      localStorage.setItem( name, JSON.stringify( graph, null, 2 ) );
      localStorage.setItem( 'lastFilename', name );
    }
  }

  onGraphDownloadClick(){
    let name = window.prompt( "Filename for download: ");
    if(name){
      if(!name.endsWith('.json')) name = `${name}.json`;
      const link = qs('#download');
      const graph = this.#ui.graph.toJSON();
      const data = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(graph))}`;
      
      link.setAttribute( 'href', data );
      link.setAttribute( 'download', name );
      
      link.click();
    }
  }

  onGraphUploadClick(){
    const input = qs('#upload');
    input.onchange = () => {
      const file = input.files[0]
      const reader = new FileReader();
      reader.onload = () => {
        this.openGraph(reader.result)
      }
      reader.readAsText(file);  
    }

    input.showPicker();
  }
  //#endregion

  //#region vertices menu handlers
  onNewVertexClick(){
    const vertex = this.#ui.graph.addVertex( Object.assign({}, this.#ui.graph.defaults.vertex) );
  }

  onNewNeighborClick(){
    this.#ui.graph.selected.forEach(a => {
      const b = this.#ui.graph.addVertex(Object.assign({}, this.#ui.graph.defaults.vertex));
      this.#ui.graph.addEdge(a.id, b.id, Object.assign({}, this.#ui.graph.defaults.edge));
    })
  }

  onSelectAllClick(){
    this.#ui.graph.vertices.forEach(v => v.selected = true);
  }

  onRemoveVertexClick(){
    [...this.#ui.graph.selected.values()].forEach(vertex => this.#ui.graph.removeVertex(vertex.id));
  }

  onConnectClick(){
    const V = [...this.#ui.graph.selected.values()];
    if(V.length === 2){
      const a = V[0];
      const b = V[1];
      this.#ui.graph.addEdge(a.id, b.id, Object.assign({}, this.#ui.graph.defaults.edge));
    }

    if(V.length > 2){
      let previous = 0;
      let current = 1;
      while(current < V.length){
        this.#ui.graph.addEdge(V[previous].id, V[current].id, Object.assign({}, this.#ui.graph.defaults.edge));
        previous++;
        current++;
      }
      this.#ui.graph.addEdge(V[previous].id, V[0].id, Object.assign({}, this.#ui.graph.defaults.edge));
    }
  }

  #clipboard = {
    V: new Map(),
    E: new Map(),
    clear: function(){
      this.V.clear();
      this.E.clear();
    }
  }

  onCutClick(){
    this.#clipboard.clear();
    for(const v of this.#ui.graph.selected.values()){
      this.#clipboard.V.set(v.id, v.toJSON());

      for(const e of v.edges.values()){
        if(e.source.id === v.id){
          this.#clipboard.E.set(e.id, e.toJSON());
        }
      }

      this.#ui.graph.removeVertex(v.id);
    }
  }

  onCopyClick(){
    this.#clipboard.clear();
    for(const v of this.#ui.graph.selected.values()){
      this.#clipboard.V.set(v.id, v.toJSON());

      for(const e of v.edges.values()){
        if(e.source.id === v.id){
          this.#clipboard.E.set(e.id, e.toJSON());
        }
      }
    }
  }

  async onPasteClick(){
    const pastedV = new Map();

    for(const old of this.#clipboard.V.values()){
      const fresh = graph.addVertex(Object.assign({}, old, {id: null}));
      pastedV.set(old.id, fresh.id);
      await wait(10);
    }

    for(const old of this.#clipboard.E.values()){
      graph.addEdge(
        pastedV.get(old.sourceId),
        pastedV.get(old.targetId),
        Object.assign({}, old, {id: null})
      )

      await wait(10);
    }
  }
  //#endregion

  //#region editing menu handlers
  onVertexColorChange(e){
    this.#ui.graph.selected.forEach( (vertex) => vertex.color = e.target.value );
  }

  onVertexSelectionColorChange(e){
    this.#ui.graph.selected.forEach( (vertex) => vertex.selectionColor = e.target.value );
  }

  onVertexTextureChange(e){
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.addEventListener( 'load', () => {
      this.#ui.graph.selected.forEach( vertex => vertex.texture = reader.result )
    })
    reader.readAsDataURL( file );
  }

  onVertexSizeChange(e){
    this.#ui.graph.selected.forEach( (vertex) => vertex.size = e.target.value );
  }

  onVertexLabelChange(e){
    this.#ui.graph.selected.forEach( (vertex) => vertex.label = e.target.value);
  }

  onVertexVisibleChange(e){
    this.#ui.graph.selected.forEach( (vertex) => vertex.visbile = e.target.checked );
  }
  //#endregion  

  //#region constants
  #setupUIConstant(name){
    // calculate selectors
    const itemSel = `#constants-${name}-item`;
    const baseSel = `${itemSel}>.base`;
    const expSel = `${itemSel}>.exp`;
    const outSel = `${itemSel}>label>output`;

    const itemName = name
      .split('-')
      .reduce(
        (sum, part, i) => i > 0 ? 
        `${sum}${part[0].toUpperCase()}${part.substring(1)}` : 
        `${sum}${part}`, ''
      );

    // retrieve value
    const value = Constants[itemName];

    // set up "input" event handler
    const onConstantsInput = (e) => {
      const value = this.#readUIConstant(name);
      qs(outSel).value = value.toExponential(3);
      this.#setConstant(name, value);
    }
    qs(baseSel).addEventListener('input', onConstantsInput);
    qs(expSel).addEventListener('input', onConstantsInput);

    // adjust the ui
    this.#setUIConstant(name, value);
  }

  #setConstant(name, value){
    const itemName = name
    .split('-')
    .reduce(
      (sum, part, i) => i > 0 ? 
      `${sum}${part[0].toUpperCase()}${part.substring(1)}` : 
      `${sum}${part}`, ''
    );

    Constants[itemName] = value;
  }

  #setUIConstant(name, value){
    const exponential = value.toExponential(2).split('e');
    const base = parseFloat(exponential.at(0)) / 10;
    const exponent = parseInt(exponential.at(1)) + 1;

    const itemSel = `#constants-${name}-item`;
    const baseSel = `${itemSel}>.base`;
    const expSel = `${itemSel}>.exp`;
    const outSel = `${itemSel}>label>output`;

    qs(baseSel).value = base;
    qs(expSel).value = exponent;
    qs(outSel).value = `${base}e${exponent}`;
  }

  #readUIConstant(name){
    const itemSel = `#constants-${name}-item`;
    const baseSel = `${itemSel}>.base`;
    const expSel = `${itemSel}>.exp`;

    return parseFloat( `${qs(baseSel).value}e${qs(expSel).value}` );  
  }
  //#endregion
}

new App();