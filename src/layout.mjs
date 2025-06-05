/*
  layout-graph

  Vertex
  .id                 (get)
  .group              (get)
  .color              (get, set)
  .resetColor(color)
  .texture            (get, set)
  .selectionColor     (get, set)
  .size               (get, set)
  .selected           (get, set)
  .update()
  .remove()
  .pos                (get, set)
  .position           (get, set) (alias)

  Edge
  .id                 (get)
  .group              (get)
  .source             (get)
  .target             (get)
  .update()
  .remove()
  .color              (get, set)

  Graph
  .constructor(parent)
  .backgrouundColor   (set)
  .addVertex(options)                   => Vertex
  .addEdge(sourceId, targetId, options) => Edge
  .removeVertex(id)            => true
  .removeEdge(id)              => true

*/

import * as three from "../node_modules/three/build/three.module.js";
import { OrbitControls } from "../node_modules/three/examples/jsm/controls/OrbitControls.js";
import { SelectionBox } from "../node_modules/three/examples/jsm/interactive/SelectionBox";
import { SelectionHelper } from "../node_modules/three/examples/jsm/interactive/SelectionHelper";
import { Line2 } from "../node_modules/three/examples/jsm/lines/Line2.js"
import { LineGeometry } from "../node_modules/three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "../node_modules/three/examples/jsm/lines/LineMaterial.js";

const create = function(innerText){
  const temp = document.createElement('div');
  temp.innerHTML = innerText;
  return temp.firstChild;
}

const wait = async function(delay){
  return new Promise((resolve, reject) => setTimeout(resolve, delay));
}

/**
 * An 3D arrow object for visualizing directions.
 *
 * ```js
 * const dir = new THREE.Vector3( 1, 2, 0 );
 *
 * //normalize the direction vector (convert to vector of length 1)
 * dir.normalize();
 *
 * const origin = new THREE.Vector3( 0, 0, 0 );
 * const length = 1;
 * const hex = 0xffff00;
 *
 * const arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
 * scene.add( arrowHelper );
 * ```
 *
 * @augments Object3D
 */
class ArrowHelper extends three.Object3D {

  /**
   * Constructs a new arrow helper.
   *
   * @param {Vector3} [dir=(0, 0, 1)] - The (normalized) direction vector.
   * @param {Vector3} [origin=(0, 0, 0)] - Point at which the arrow starts.
   * @param {number} [length=1] - Length of the arrow in world units.
   * @param {(number|Color|string)} [color=0xffff00] - Color of the arrow.
   * @param {number} [linewidth] - width of the arrow line.
   * @param {number} [headLength=length*0.2] - The length of the head of the arrow.
   * @param {number} [headWidth=headLength*0.2] - The width of the head of the arrow.
   */
  constructor(  dir = new Vector3( 0, 0, 1 ), origin = new Vector3( 0, 0, 0 ), length = 1, color = 0xffff00, linewidth = 1.0, headLength = length * 0.2, headWidth = headLength * 0.2 ) {

    super();

    this.type = 'ArrowHelper';

    const normDir = dir.clone().normalize();
    const scaleDir = normDir.multiplyScalar(length);
    const end = origin.clone().add(scaleDir);

    _lineGeometry = new LineGeometry();
    _lineGeometry.setFromPoints([origin.clone(), end]);
    _coneGeometry = new three.CylinderGeometry( 0, 0.2, 0.7 );
    _coneGeometry.translate( 0, -1.0, 0 );

    this.position.copy( origin );

    /**
     * The line part of the arrow helper.
     *
     * @type {Line2}
     */
    this.line = new Line2( _lineGeometry, new LineMaterial({ linewidth, color, toneMapped: false }) );
    this.line.matrixAutoUpdate = false;
    this.add( this.line );

    /**
     * The cone part of the arrow helper.
     *
     * @type {Mesh}
     */
    this.cone = new three.Mesh( _coneGeometry, new three.MeshBasicMaterial( { color, toneMapped: false } ) );
    this.cone.matrixAutoUpdate = false;
    this.add( this.cone );

    this.setDirection( dir );
    this.setLength( length, headLength, headWidth );

  }

  /**
   * Sets the direction of the helper.
   *
   * @param {Vector3} dir - The normalized direction vector.
   */
  setDirection( dir ) {
    // dir is assumed to be normalized
    let _axis = new three.Vector3();
    if ( dir.y > 0.99999 ) {
      this.quaternion.set( 0, 0, 0, 1 );
    } else if ( dir.y < -0.99999 ) {
      this.quaternion.set( 1, 0, 0, 0 );
    } else {
      _axis.set( dir.z, 0, - dir.x ).normalize();
      const radians = Math.acos( dir.y );
      this.quaternion.setFromAxisAngle( _axis, radians );
    }
  }

  /**
   * Sets the length of the helper.
   *
   * @param {number} length - Length of the arrow in world units.
   * @param {number} [headLength=length*0.2] - The length of the head of the arrow.
   * @param {number} [headWidth=headLength*0.2] - The width of the head of the arrow.
   */
  setLength( length, headLength = length * 0.2, headWidth = headLength * 0.2 ) {

    this.line.scale.set( 1, Math.max( 0.0001, length - headLength ), 1 ); // see #17458
    this.line.updateMatrix();

    this.cone.scale.set( headWidth, headLength, headWidth );
    this.cone.position.y = length;
    this.cone.updateMatrix();

  }

  /**
   * Sets the color of the helper.
   *
   * @param {number|Color|string} color - The color to set.
   */
  setColor( color ) {

    this.line.material.color.set( color );
    this.line.material.needsUpdate = true;
    this.cone.material.color.set( color );
    this.cone.material.needsUpdate = true;

  }

  setWidth( width ){
    this.line.material.linewidth = width;
    this.line.material.needsUpdate = true;
  }

  copy( source ) {

    super.copy( source, false );

    this.line.copy( source.line );
    this.cone.copy( source.cone );

    return this;

  }

  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   */
  dispose() {

    this.line.geometry.dispose();
    this.line.material.dispose();
    this.cone.geometry.dispose();
    this.cone.material.dispose();

  }
}

class LineHelper {
  static generateLine( from, to, options ){
    const group = new three.Group();
    group.name = 'edge-line';

    const geometry = new LineGeometry();
    geometry.setFromPoints([ from, to ]);
    const material = new LineMaterial({
      color: options.color,
      linewidth: options.width
    });
    const line = new Line2( geometry, material );
    line.name = 'line';

    group.add( line );

    return group;
  }

  static generateArrow( from, to, options ){
    const group = new three.Group();
    group.name = 'edge-arrow';

    // create line
    const lineGeo = new LineGeometry();
    lineGeo.setFromPoints([ from, to ]);
    const lineMat = new LineMaterial({
      color: options.color,
      linewidth: options.width
    });
    const line = new Line2( lineGeo, lineMat );
    line.name = 'line';

    // create cone
    // const coneGeo = new three.CylinderGeometry(0, 0.5, 1);
    const coneGeo = new three.CylinderGeometry( 0, 0.2, 0.7);
    coneGeo.translate( 0, -1.0, 0 );
    coneGeo.rotateX(- Math.PI / 2);
    const coneMat = new three.MeshBasicMaterial({
      color: options.color,
      toneMapped: false
    });
    const cone = new three.Mesh( coneGeo, coneMat );
    cone.name = 'cone';

    group.add(line);
    group.add(cone);
    //cone.rotateY(Math.PI/2)

    return group;
  }

  static updateArrow( group, from, to ){
    const line = group.getObjectByName('line');
    const cone = group.getObjectByName('cone');

    line.geometry.setFromPoints([ from, to ]);
    cone.position.copy( to );
    cone.lookAt( from );

    line.geometry.needsUpdate = true;
  }

  static updateLine( group, from, to ){
    const line = group.getObjectByName('line');
    line.geometry.setFromPoints( [ from, to ] );
    line.geometry.needsUpdate = true;
  }
}

class Constants {
  // spring constant; more K, more attraction
  static K = 2.0e-2

  // repulsion constant; more f0, more repulsion
  static f0 = 1.0e+2;

  // time step; more dt, faster simulation
  static dt = 0.02;
  
  // damping constant; more D, more damping
  static D = 0.75;

  // minimum distance; to avoid division by zero
  static epsilon = 0.1;

  // Barnes-Hut theta; more theta, less accuracy and more speed
  static theta = 0.5;

  // Inner distance: Used by the Barnes Hut Tree to determine proximity
  static innerDistance = 100.0;

  static toJSON(){
    return {
      K:              Constants.K,
      f0:             Constants.f0,
      dt:             Constants.dt,
      D:              Constants.D,
      epsilon:        Constants.epsilon,
      theta:          Constants.theta,
      innerDistance:  Constants.innerDistance
    };
  }

  static fromJSON(c){
    Constants.K             = c.K;
    Constants.f0            = c.f0;
    Constants.dt            = c.dt;
    Constants.D             = c.D;
    Constants.epsilon       = c.epsilon;
    Constants.theta         = c.theta;
    Constants.innerDistance = c.innerDistance;    
  }
}

class Octree {
  constructor(){
    this.inners = new Set();
    this.outers = new Map();
    this.centerSum = new three.Vector3(
      Math.random() * 10,
      Math.random() * 10,
      Math.random() * 10
    );
    this.count = 0;
  }

  center(){
    let centerSum = Array.from(this.inners).reduce((prev, cur) => {
      return prev.add(cur.position);
    }, new three.Vector3(
      Math.random() * 10,
      Math.random() * 10,
      Math.random() * 10
    ));

    let count = this.inners.size;

    if(count > 0){
      return centerSum.divideScalar(count);
    }else{
      return centerSum;
    }
  }

  get position(){
    return this.center();
  }

  insert(vertex){
    this.count++;
    this.centerSum.add(vertex.position);

    if(this.inners.size == 0){
      this.placeInner(vertex);
    }else{
      var dist = this.center().clone().sub(vertex.position);

      if(dist.length() < Constants.innerDistance){
        this.placeInner(vertex);
      }else{
        this.placeOuter(vertex);
      }
    }
  }

  remove(vertex){
    if(this.inners.has(vertex)){
      this.inners.delete(vertex);
      this.count--;
    }else{
      for(let [key, octree] of this.outers){
        if(octree.contains(vertex)){
          octree.remove(vertex);
          if(octree.size === 0){
            this.outers.delete(key);
          }
          break;
        }
      }
    }
  }

  estimate(v, forceFn){
    var f = new three.Vector3();
    if(this.inners.has(v)){
      for(var inner of this.inners){
        if(inner.id != v.id){
          var force = forceFn(v, inner);
          f.add(force);
        }
      }
    }else{
      f.add(forceFn(v, this)).multiplyScalar(this.inners.size);
    }

    this.outers.forEach((octree, key) => {
      var dist = this.center().sub(octree.center());
      var d = dist.lengthSq();

      if(d < Constants.theta * this.size){
        f.add(octree.estimate(v, forceFn));
      }else{
        var force = forceFn(v, octree);
        f.add(force);
      }
    });

    return f;
  }

  get size(){
    return this.count > 0 ? this.count : 1;
  }

  getOctant(pos){
    var c = this.center();

    var x = c.x < pos.x ? 'l' : 'r';
    var y = c.y < pos.y ? 'u' : 'd';
    var z = c.z < pos.z ? 'i' : 'o';

    return `${x}${y}${z}`;
  }

  placeInner(vertex){
    this.inners.add(vertex);
  }

  placeOuter(vertex){
    var o = this.getOctant(vertex.position);
    if(!this.outers.has(o)){
      this.outers.set(o, new Octree());
    }

    this.outers.get(o).insert(vertex);
  }
}

class LayoutVertex {
  constructor(id, graph) {
    this.id = id;
    this.graph = graph;

    this.priority = Math.random(); // dynamic matching things
    this.edges = new Set();

    const s = 5;
    this.position = new three.Vector3(
      Math.random()*s, 
      Math.random()*s, 
      Math.random()*s
    );
    this.velocity = new three.Vector3(0, 0, 0);
    this.acceleration = new three.Vector3(0, 0, 0);
  }

  update() {
    this.velocity.add(this.acceleration.clone().multiplyScalar(Constants.dt));
    this.velocity.multiplyScalar(Constants.D);
    this.position.add(this.velocity.clone().multiplyScalar(Constants.dt));
    this.acceleration.set(0, 0, 0);

    return {
      id: this.id, 
      pos: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      }
    };
  }
}

class LayoutEdge {
  constructor(id, source, target, strength, graph) {    
    this.id     = id;
    this.source = source;
    this.graph  = graph;
    this.target = target;
    this.graph  = graph;
    this.strength = strength;
  }

  update() {}
}

class LayoutGraph {
  static vertexId = 0;
  static edgeId = 0;

  vertices = new Map();
  edges = new Map();
  octree = new Octree();

  constructor() {}

  addVertex(id) {
    id ??= `vertex-${LayoutGraph.vertexId++}`; // not actually needed 
    const vertex = new LayoutVertex(id, this);

    this.octree.insert(vertex);
    this.vertices.set(id, vertex);
    return id;
  }

  addEdge(id, sourceId, targetId, strength) {
    id ??= `edge-${LayoutGraph.edgeId++}`;

    strength ??= 1.0;
    const source = this.vertices.get(sourceId);
    const target = this.vertices.get(targetId);
    if(source && target){
      const edge = new LayoutEdge(id, source, target, strength, this);
      this.edges.set(id, edge);

      source.edges.add(edge);
      target.edges.add(edge);

      return id;
    }else{
      return null;
    }
  }

  removeVertex(id) {
    for(const [edgeId, edge] of this.edges){
      if(edge.sourceId === id || edge.targetId === id){
        this.removeEdge(edgeId);
      }
    }

    this.octree.remove(this.vertices.get(id));
    this.vertices.delete(id);
  }

  removeEdge(id) {
    const edge = this.edges.get(id);
    edge.source.edges.delete(edge);
    edge.target.edges.delete(edge);

    this.edges.delete(id);
  }

  update() {
    this.estimateRepulsionForces();
    this.calculateAttractionForces();
    [...this.vertices.values()].forEach(vertex => vertex.update())
  }

  async wait(n){
    return new Promise((resolve, reject) => setTimeout(resolve, delay));
  }

  estimateRepulsionForces(){
    const octree = new Octree();
    const vertices = Array.from(this.vertices.values());

    for(const vertex of vertices){
      octree.insert(vertex);
    }

    for(const vertex of vertices){
      const force = octree.estimate(vertex, (v1, v2) => {
        const difference = new three.Vector3().subVectors(v1.position, v2.position);
        const distance = difference.lengthSq() || Constants.epsilon; //lengthSq? ?? ?
        return difference.multiplyScalar(Constants.f0 / Math.pow(distance, 2));
      })

      vertex.acceleration.add(force);
    }
  }

  calculateAttractionForces(){
    for(const edge of this.edges.values()){
      const difference = new three.Vector3().subVectors(edge.source.position, edge.target.position);
      const distance = difference.length() || Constants.epsilon;
      const force = difference.multiplyScalar(Constants.K * (distance * distance)).multiplyScalar(edge.strength); 

      edge.source.acceleration.sub(force);
      edge.target.acceleration.add(force);
    }
  }
}

class Vertex {
  static newId = 0;
  #id      = null;
  #edges   = new Set();
  
  #graph   = null;
  #cube    = null;
  #wire    = null;
  #group   = null;
  #texture = null;
  #label   = null;
  #color   = null;
  #size    = null;

  constructor( graph, options = {} ){
    this.#graph = graph;
    this.#id = options?.id ?? `vertex-${Vertex.newId++}`;

    options = Object.assign({}, graph.defaults.vertex, options);

    this.#cube = new three.Mesh(
      new three.BoxGeometry( 1, 1, 1 ),
      new three.MeshPhongMaterial( { "color": options.color } )
    );
    this.#cube.name = 'cube';
    
    this.#wire = new three.Mesh( 
      new three.BoxGeometry( 1.25, 1.25, 1.25 ),
      new three.MeshPhongMaterial({ wireframe: true, "color": options.selectionColor })
    );
    this.#wire.visible = false;
    this.#wire.name = 'wire';

    this.#group = new three.Group();
    this.#group.name = 'vertex-cube'
    this.#group.add(this.#cube);
    this.#group.add(this.#wire);
    this.#group.userData.id = this.id;
    this.#group.userData.vertex = this;

    Object.assign(this, options);
  }

  get edges(){
    return this.#edges;
  }

  get graph(){
    return this.#graph;
  }

  get group(){
    return this.group;
  }

  get id(){
    return this.#id;
  }

  set id(val){ 
    this.#id = val; 
  }

  get group(){
    return this.#group;
  }

  get color(){
    return this.#cube.material.color.getHex();
  }

  set color( color ){
    this.#cube.material.color.set( color );
    this.#color = color;
  }

  resetColor( color ){
    const material = new three.MeshPhongMaterial({ color })
    this.#cube.material = material;
    this.#cube.material.needsUpdate = true;
  }

  get texture(){
    return this.#texture;
  }

  set texture(src){
    if(!src){
      const material = new three.MeshPhongMaterial({ color: this.color });
      this.#cube.material = material;
      this.#cube.material.needsUpdate = true;
      this.#texture = null;
      return;
    }

    const loader = new three.TextureLoader();
    const texture = loader.load(src);
    const material = new three.MeshPhongMaterial({ map: texture });
    this.#cube.material = material;
    this.#cube.material.needsUpdate = true;
    this.#texture = src;
  }

  get selectionColor(){
    return this.#wire.material.color.getHex();
  }

  set selectionColor( color ){
    this.#wire.material.color.set( color );
  }

  get size(){
    return this.#size;
  }

  set size( value ){
    this.#size = value;
    this.#group.scale.set( value, value, value );
  }

  get selected(){
    return this.#wire.visible;
  }
  
  set selected( value ){
    this.#wire.visible = value;
    if(value){
      this.#graph.selected.add(this);
    }else{
      this.#graph.selected.delete(this);
    }
  }

  get visible(){
    return this.#group.visible;
  }

  set visible(value){
    this.#group.visible = value;
  }

  toJSON(){
    return {
      id: this.id,
      color: this.color,
      texture: this.texture,
      selectionColor: this.selectionColor,
      size: this.size,
      label: this.label?.innerHTML,
      visible: this.visible,
      selected: this.selected
    };
  }
  
  get pos(){
    return this.#group.position;
  }
  
  set pos( { x, y, z } ){
    this.#group.position.set( x, y, z );
  }

  get label(){
    return this.#label;
  }

  set label( value ){
    if(this.label !== null && typeof value === 'string' && value === ''){
      this.#label.remove();
      this.#label = null;
    }else if(this.label !== null && typeof value === 'string' && value !== ''){
      this.#label.innerHTML = value;
    }else if(this.label !== null && typeof value === 'object' && value.text === ''){
      this.#label.remove();
      this.#label = null;
    }else if(this.label !== null && typeof value === 'object' && value.text !== ''){
      this.#label.innerHTML = value.text;
      delete value.text;
      Object.assign(this.#label.style, value);
    }else if(this.label === null && typeof value === 'string' && value !== ''){
      this.#label = this.#graph.createLabel( value, {} );
    }else if(this.label === null && typeof value === 'object' && value.text !== ''){
      const text = value.text;
      delete value.text;
      this.#label = this.#graph.createLabel( text, value );
    }
  }

  update(){
    this.pos = this.#graph.layoutGraph.vertices.get(this.id)?.position;
  }

  remove(){
    this.#graph.removeVertex(this);
    this.#cube.geometry.dispose();
    this.#cube.material.dispose();
    this.#wire.geometry.dispose();
    this.#wire.material.dispose();
  }

  // aliases
  get position(){
    return this.pos;
  }
  
  set position({ x, y, z }){
    this.pos = { x, y, z };
  }
}

class Edge {
  static newId = 0;
  #id = null;
  
  #graph  = null;
  #line   = null;
  #group  = null;
  
  #source = null;
  #target = null;

  #strength = null;
  #arrow = false;
  #color = null;
  #width = null;

  #arrowHelper = null;
  #label = null;

  constructor( graph, source, target, options = {} ){
    this.#id = options?.id ?? `edge-${Edge.newId++}`;
    this.#graph = graph;
    this.#source = source;
    this.#target = target;

    options = Object.assign({}, graph.defaults.edge, options);

    this.#arrow = options.arrow ?? graph.defaults.edge.arrow;
    this.#color = options.color ?? graph.defaults.edge.color;
    this.#width = options.width ?? graph.defaults.edge.width;
    this.#strength = options.strength ?? graph.defaults.edge.strength;

    // call generateArrow or generateLine dep. on arrow option
    this.#group = (this.#arrow ? 
      LineHelper.generateArrow : 
      LineHelper.generateLine)(
        this.#source.pos,
        this.#target.pos,
        {
          color: this.#color,
          width: this.#width
        }
    );

    this.#group.userData.id = this.id;
    this.#group.userData.edge = this;

    this.#source.edges.add(this);
    this.#target.edges.add(this);

    Object.assign(this, options);
  }

  get label(){
    return this.#label;
  }

  set label( value ){
    if(!value){
      this.#label?.remove();
      this.#label = null;
    }

    if(this.label !== null && typeof value === 'string' && !value){
      this.#label.remove();
      this.#label = null;
    }else if(this.label !== null && typeof value === 'string' && !value){
      this.#label.innerHTML = value;
    }else if(this.label !== null && typeof value === 'object' && !value?.text){
      this.#label.remove();
      this.#label = null;
    }else if(this.label !== null && typeof value === 'object' && !value?.text){
      this.#label.innerHTML = value.text;
      delete value.text;
      Object.assign(this.#label.style, value);
    }else if(this.label === null && typeof value === 'string' && value){
      this.#label = this.#graph.createLabel( value, {} );
    }else if(this.label === null && typeof value === 'object' && value?.text){
      const text = value.text;
      delete value.text;
      this.#label = this.#graph.createLabel( text, value );
    }
  }

  get source(){
    return this.#source;
  }

  get target(){
    return this.#target;
  }

  get options(){
    return {
      color: this.color,
      width: this.width,
      strength: this.strength,
      visible: this.visible,
      arrow: this.arrow
    }
  }

  get id(){
    return this.#id;
  }

  set id(val){ 
    this.#id = val 
  } 

  get group(){
    return this.#group;
  }

  get color(){
    return this.#color;
  }

  set color( color ){
    const line = this.#group.getObjectByName('line');
    line.material.color.set( color );
    line.material.needsUpdate = true;

    if(this.#arrow){
      const cone = this.#group.getObjectByName('cone');
      cone.material.color.set( color );
      cone.material.needsUpdate = true;
    }
  
    this.#color = color;
  }

  get width(){
    return this.#width;
  }

  set width( value ){
    this.#width = value;

    const line = this.#group.getObjectByName('line');
    line.material.linewidth = value;
    line.material.needsUpdate = true;
  }

  get strength(){
    return this.#graph.layoutGraph.edges.get( this.#id ).strength;
  }

  set strength(val){
    this.#strength = val;
    const le = this.#graph.layoutGraph.edges.get( this.#id );
    if(le) le.strength = val;
  }

  get visible(){
    return this.#group.visible;
  }

  set visible(val){
    this.#group.visible = val;
  }

  get arrow(){
    return this.#arrow;
  }

  set arrow( val ){
    if(val !== this.#arrow){
      const parent = this.#group.parent;
      this.#group.removeFromParent();

      const line = this.#group.getObjectByName('line');
      line.material.dispose();
      line.geometry.dispose();

      const cone = this.#group.getObjectByName('cone');
      cone?.material.dispose();
      cone?.material.dispose();

      const options = this.options;

      let fn = null;
      if(val && !this.#arrow) fn = LineHelper.generateArrow;
      if(!val && this.#arrow) fn = LineHelper.generateLine;
      this.#group = fn(this.#source.pos, this.#target.pos, options);

      parent.add(this.#group);
      this.#arrow = val;
    }
  }

  toJSON(){
    return {
      id: this.id,
      sourceId: this.source.id,
      targetId: this.target.id,
      color: this.color,
      arrow: this.arrow,
      label: this.label?.innerHTML,
      strength: this.strength
    };
  }

  update(){
    (this.#arrow ? 
    LineHelper.updateArrow : 
    LineHelper.updateLine)( 
      this.#group, 
      this.#source.pos, 
      this.#target.pos
    )
  }

  remove(){
    this.#graph.removeEdge(this);
    this.#line.geometry.dispose();
    this.#line.material.dispose();
  }
}

class Graph {
  #parent      = null;
  #scene       = null;
  #skyColor    = null;
  #groundColor = null;
  #intensity   = null;
  #light       = null;
  #camera      = null;
  #renderer    = null;
  #controls    = null;

  #vertices     = new Map();
  #edges        = new Map();
  
  layoutGraph  = null;
  selected     = null;

  #selectionBox = null;
  #selectionHelper = null;
  #constants = Constants.toJSON();
  
  constructor( elem ){
    this.#parent = elem;

    // using the threejs library to create a scene
    this.#scene = new three.Scene();
    
    // light
    this.#skyColor = 0xffffff;
    this.#groundColor = 0x878787;
    this.#intensity = 85.0;
    this.#light = new three.HemisphereLight( 
      this.#skyColor,
      this.#groundColor 
    );
    this.#scene.add( this.#light );
    
    // the camera lets us look into the scene
    this.#camera = new three.PerspectiveCamera( 75, elem.clientWidth/elem.clientHeight, 0.1, 1000 );
    this.#camera.position.z = 25;
    
    // the renderer renders the scene onto a canvas element
    this.#renderer = new three.WebGLRenderer({ antialias: true });
    this.#renderer.setSize( elem.clientWidth, elem.clientHeight );
    this.#renderer.setClearColor( 'white' );
    this.#renderer.domElement.style.width = '100%';
    this.#renderer.domElement.style.height = '100%';
    this.#renderer.domElement.style.display = 'block';
    this.#renderer.setAnimationLoop( this.#animate.bind( this ) );
  
    this.#controls = new OrbitControls( this.#camera, this.#renderer.domElement );
    
    elem.appendChild( this.#renderer.domElement )

    this.layoutGraph = new LayoutGraph();

    window.addEventListener('resize', this.#resize.bind(this));

    this.selected = new Set();
    this.#renderer.domElement.addEventListener('click', this.#onClick.bind(this), false);

    this.#selectionBox = new SelectionBox( this.#camera, this.#scene );
    this.#selectionHelper = new SelectionHelper( this.#renderer, 'selectBox' );
    this.canvas.addEventListener('pointerdown', this.onPointerdown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointermove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerup.bind(this));
  }

  clear(){
    this.#vertices.forEach( v => this.removeVertex( v.id ) );
    Vertex.newId = 0;
    Edge.newId = 0;
  }

  defaults  = {
    vertex: {
      color: 0x6495ed,
      selectionColor: 0xffa500,
      texture: null,
      size: 1.0,
      label: {
        text: '', 
        fontSize: 12, 
        color: 0xffffff, 
        backgroundColor: 0x000000
      },
      selected: false,
      visible: true
    },
    edge: {
      color: 0x000000,
      strength: 1.0,
      label: null,
      arrow: false,
      width: 3
    }
  }

  onPointerdown(e){
    if(!e.altKey){
      this.#controls.enabled = true;
      this.#selectionHelper.enabled = false;
      return;
    }
    e.preventDefault();

    this.#controls.enabled = false;
    this.#selectionHelper.enabled = true;

    for(const item of this.#selectionBox.collection){
      if(item.name === 'cube'){
        item.parent.userData.vertex.selected = false;
      }
    }

    this.#selectionBox.startPoint.set(
      (e.clientX / this.#renderer.domElement.clientWidth) * 2 - 1,
      -(e.clientY / this.#renderer.domElement.clientHeight) * 2 + 1, 
      0.5
    );
  }

  onPointermove(e){
    e.preventDefault();
    if(!e.altKey){
      this.#controls.enabled = true;
      this.#selectionHelper.enabled = false;
      return;
    }

    this.#controls.enabled = false;
    this.#selectionHelper.enabled = true;
   

    if( this.#selectionHelper.isDown ){
      for(let item of this.#selectionBox.collection){
        if(item.name === 'cube'){
          item.parent.userData.vertex.selected = false;
        }        
      }

      this.#selectionBox.endPoint.set(
        (e.clientX / this.#renderer.domElement.clientWidth) * 2 - 1,
        -(e.clientY / this.#renderer.domElement.clientHeight) * 2 + 1,
        0.5
      );

      for(let selected of this.#selectionBox.select()){
        if(selected.name === 'cube'){
          selected.parent.userData.vertex.selected = true;
        }
      }
    }
  }

  onPointerup(e){
    e.preventDefault();
    if(!e.altKey){
      this.#controls.enabled = true;
      this.#selectionHelper.enabled = false;
      return;
    }

    this.#controls.enabled = false;
    this.#selectionHelper.enabled = true;

    this.#selectionBox.endPoint.set(
      (e.clientX / this.#renderer.domElement.clientWidth) * 2 - 1,
      -(e.clientY / this.#renderer.domElement.clientHeight) * 2 + 1,
      0.5
    );

    const allSelected = this.#selectionBox.select();
    for(let selected of allSelected){
      if(selected.name === 'cube'){
        selected.parent.userData.vertex.selected = true;
      }
    }
  }

  set constants(obj){
    Constants.fromJSON(Object.assign(Constants.toJSON(), obj));
  }

  get constants(){
    return Constants.toJSON();
  }

  async fromJSON(json){
    this.clear();
    Constants.fromJSON(json.constants);
    Object.assign(this.defaults, json.defaults);

    for(let vertex of json.V){
      await wait(50);
      this.addVertex(vertex);
    }
    for(let edge of json.E){
      await wait(50);
      this.addEdge(edge.sourceId, edge.targetId, edge);
    }
  }

  toJSON(){
    return {
      constants: Constants.toJSON(),
      defaults: this.defaults,
      V: [...this.#vertices.values()].map( vertex => vertex.toJSON() ),
      E: [...this.#edges.values()].map( edge => edge.toJSON() )
    }
  }

  get vertices(){
    return [...this.#vertices.values()];
  }

  get edges(){
    return [...this.#edges.values()];
  }

  get canvas(){
    return this.#renderer.domElement;
  }

  #animate(){
    this.layoutGraph.update();
    this.#vertices.forEach(ov => ov.update());
    this.#edges.forEach(oe => oe.update());
    this.#updateLabels();
    this.#controls.update();

    this.#renderer.render( this.#scene, this.#camera );
  }

  set backgroundColor( color ){
    this.#renderer.setClearColor( color );
  }

  #onClick(e){
    const mouse = new three.Vector2();
    const raycaster = new three.Raycaster();
    let intersects = [], vertex = null;

    if(!e.ctrlKey && !e.altKey){
      [...this.selected.values()].forEach(v => v.selected = false);
    }

    mouse.set(
      (e.clientX / this.#renderer.domElement.clientWidth) * 2 - 1,
      -(e.clientY / this.#renderer.domElement.clientHeight) * 2 + 1
    );

    raycaster.setFromCamera( mouse, this.#camera );
    intersects = raycaster
      .intersectObjects( this.#scene.children )
      .filter(io => ['wire', 'cube'].includes(io.object.name));

    if(intersects.length){
      vertex = intersects[0]?.object.parent.userData.vertex;
      vertex.selected = e.ctrlKey ? !vertex.selected : true;

      this.#renderer.domElement.dispatchEvent(
        new CustomEvent( 'vertex-click', {detail: vertex} )
      );

      this.#renderer.domElement.dispatchEvent(
        new CustomEvent( 'vertex-select', {detail: this.selected} )
      );
    }
  }

  #resize(){
    this.#renderer.setSize( this.#parent.clientWidth, this.#parent.clientHeight, false );
    const canvas = this.#renderer.domElement;
    this.#camera.aspect = canvas.clientWidth / canvas.clientHeight;
    this.#camera.updateProjectionMatrix();
  }

  createLabel(text, style){
    if(text === null || text === '') return null;

    const label = create(`<label class="label">${text}</label>`);

    for(let key of Object.keys(style)){
      if(!label.style.hasOwnProperty(key)){
        delete style[key];
      }
    }
    
    Object.assign(label.style, {
      position:         'fixed',
      color:            'black',
      backgroundColor:  'white',
      border:           '1px dotted white',
      overflow:         'hidden',
      fontSize:         '12px',
      zIndex:           1,
      display:          'block'
    }, style);

    this.#parent.appendChild(label);
    return label;
  }

  #isObscured(object){
    const cam = new three.Vector3();
    this.#camera.getWorldPosition( cam );

    const point = new three.Vector3();
    object.getWorldPosition( point );
    
    const raycaster = new three.Raycaster();
    raycaster.setFromCamera( point, this.#camera )
    const intersects = raycaster.intersectObjects( this.#scene.children )
    
    if(intersects.length > 0){
      const distance = cam.distanceTo( point );
      if( intersects[0].distance < distance - 0.001 ){
        return true;
      }
    }

    return false;
  }

  #updateLabels(){
    const raycaster = new three.Raycaster();
    const canvas = this.#renderer.domElement;
    const camera = this.#camera;
    raycaster.ray.origin.copy( camera.position );
    let label, pos;

    this.#scene.traverseVisible((object) => {
      if((object.name === 'vertex-cube') || (object.name === 'edge-line') || (object.name === 'edge-arrow')){
        label = object.userData.vertex?.label ?? object.userData.edge?.label;

        if(!label) return;
        if(this.#isObscured(object)){
          label.style.display = 'none';
          return;
        }else{
          label.style.display = 'block';
        }

        if(object.name.startsWith('vertex')){
          raycaster.ray.direction.copy( object.position.clone().sub( camera.position ).normalize() );
        }else if(object.name.startsWith('edge')){
          raycaster.ray.direction.copy(
            object.userData.edge.source.position.clone()
            .add(object.userData.edge.target.position).divideScalar(2.0)
            .sub( camera.position ).normalize()
          );
        }

        // client coords
        if(object.name.startsWith('vertex')){
          pos = object.position.clone();
        }else if(object.name.startsWith('edge')){
          pos = object.userData.edge.source.position.clone()
                .add(object.userData.edge.target.position)
                .divideScalar(2.0);
        }
      
        pos.project( camera );
        let coords = {
          x: Math.round( ( pos.x + 1 ) / 2 * canvas.clientWidth),
          y: Math.round( ( -pos.y + 1 ) / 2 * canvas.clientHeight)
        };

        if((coords.x <= 0) || (coords.y <= 0) || (coords.x >= canvas.clientWidth) || (coords.y >= canvas.clientHeight) ){
          label.style.display = 'none';
        }else{
          label.style.display = 'block';
        }
  
        let rect = canvas.getBoundingClientRect();
        const offset = object.name.startsWith('vertex') ? 50 : 25;
        label.style.left = `${rect.left + coords.x - label.offsetWidth / 2}px`;
        label.style.top = `${rect.top + coords.y + offset - label.offsetHeight / 2}px`;
      }
    });
  }

  #toClientCoords(scenePos, camera, canvas){
    let position = scenePos.clone();
    position.project( camera );
    let x = Math.round( position.x + 1 ) / 2 * canvas.clientWidth;
    let y = Math.round( position.y + 1 ) / 2 * canvas.clientHeight;

    return { x, y }
  }

  addVertex(options = {}){
    options.id ??= LayoutGraph.vertexId++;
    const vertex = new Vertex( this, options );
    this.#scene.add( vertex.group );
    this.#vertices.set( vertex.id, vertex );
    this.layoutGraph.addVertex( vertex.id );

    // await wait(10)?
    return vertex;
  }

  removeVertex( id ){
    try{
      // retrieve vertex
      const vertex = this.#vertices.get(id);
      if(!vertex) return false;

      // remove incident edges
      [...this.#edges.values()]
      .filter(edge => (edge.source.id === vertex.id) || (edge.target.id === vertex.id))
      .forEach(edge => this.removeEdge(edge.id));

      // remove vertex
      this.#vertices.delete( vertex.id );

      // undraw vertex
      vertex.group.removeFromParent();
      this.layoutGraph.removeVertex( vertex.id );

      vertex.label?.remove();
      delete vertex.label;
      
      return true;
    }catch(e){
      console.error(e);
    }
  }

  addEdge(sourceId, targetId, options = {}){
    options.id ??= LayoutGraph.edgeId++;
    options = Object.assign( {}, this.defaults.edge, options )

    const source = this.#vertices.get( sourceId );
    const target = this.#vertices.get( targetId );
    const edge = new Edge( this, source, target, options );
    this.#scene.add( edge.group );
    this.#edges.set( edge.id, edge );
    this.layoutGraph.addEdge( edge.id, edge.source.id, edge.target.id, options.strength );

    // await wait(10);
    return edge;
  }

  removeEdge( id ){
    try{
      // retrieve edge
      const edge = this.#edges.get( id );
      if(!edge) return false;
      
      // delete edge
      this.#edges.delete( edge.id );
      
      // undraw edge
      edge.group.removeFromParent()
      this.layoutGraph.removeEdge( edge.id );

      edge.label?.remove();
      delete edge.label;

      return true;
    }catch(e){
      console.error(e);
    }
  }
}

export { Graph, Constants }
