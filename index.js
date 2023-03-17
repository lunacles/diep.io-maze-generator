window.CP.PenTimer.MAX_TIME_IN_LOOP_WO_EXIT = 6000

let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d')
let width = 40
let height = 40
let pixelSize= 10
canvas.width = pixelSize * width
canvas.height = pixelSize * height
ctx.scale(pixelSize, pixelSize)

// CREDIT: https://gist.github.com/blixt/f17b47c62508be59987b
const Seed = class {
  constructor(seed) {
    this.seed = seed % 2147483647
    if (this.seed <= 0) 
      this.seed += 2147483646
  }
  next() {
    return this.seed = this.seed * 16807 % 2147483647
  }
  nextFloat(opt_minOrMax, opt_max) {
    return (this.next() - 1) / 2147483646
  }
}
// CREDIT: https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
const cyrb53 = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed
    let h2 = 0x41c6ce57 ^ seed
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i)
        h1 = Math.imul(h1 ^ ch, 2654435761)
        h2 = Math.imul(h2 ^ ch, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1>>>16), 2246822507) ^ Math.imul(h2 ^ (h2>>>13), 3266489909)
    h2 = Math.imul(h2 ^ (h2>>>16), 2246822507) ^ Math.imul(h1 ^ (h1>>>13), 3266489909)
    return 4294967296 * (2097151 & h2) + (h1>>>0)
}

const direction = [
  [-1, 0], [1, 0], // left and right
  [0, -1], [0, 1], // up and down
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

let alreadyPlaced = []

const placeWalls = async (map, debugType = -1) => {
  if (debugType === 0 || debugType === -1)
    map.walls = map.entries().filter(([x, y, r]) => r === 1).map(([x, y, r]) => ({x, y, width: 1, height: 1}))
  
  for (let {x, y, width, height} of map.walls) {
    if (alreadyPlaced.find(r => r.x === x && r.y === y) && Math.abs(debugType) !== 1) continue
    if (Math.abs(debugType) !== 1) await sleep(8)
    ctx.fillStyle = '#cdcdcd'
    ctx.fillRect(x + 1.5, y + 1.5, width, height)
    
    ctx.strokeStyle = '#00000080'
    ctx.lineWidth = 0.01
    ctx.fillStyle = '#9f9f9f80'
    ctx.fillRect(x + 1.5, y + 1.5, width, height)
    ctx.strokeRect(x + 1.5, y + 1.5, width, height)  
    if (Math.abs(debugType) !== 1) {
      alreadyPlaced.push({x, y})
    } else {
      map.walls.shift()
    }
  }
}

const findPockets = async (map, debug) => {
  let queue = [[0, 0]]
  map.set(0, 0, 2)
  let checkedIndices = new Set([0])
  for (let i = 0; i < 5000 && queue.length > 0; i++) {
    let [x, y] = queue.shift()
    for (let [nx, ny] of [
      [x - 1, y], // left
      [x + 1, y], // right
      [x, y - 1], // top
      [x, y + 1], // bottom
    ]) {
      if (nx < 0 || nx > map.width - 1 || ny < 0 || ny > map.height - 1) continue
      if (map.get(nx, ny) !== 0) continue
      let i = ny * map.width + nx
      if (checkedIndices.has(i)) continue
      checkedIndices.add(i)
      queue.push([nx, ny])
      map.set(nx, ny, 2)
      
      if (debug) {
        ctx.fillStyle = '#ff000080'
        ctx.fillRect(nx + 1.5, ny + 1.5, 0.95, 0.95)
        await sleep(1)
      }
    }
  }
  for (let [x, y, r] of map.entries()) {
    if (r === 2) {
      if (!debug) continue
      ctx.fillStyle = '#cdcdcd'
      ctx.fillRect(x + 1.5, y + 1.5, 1, 1)
      await sleep(1)
    } else if (r === 0) {
      map.set(x, y, 1)
      if (!debug) continue
      ctx.fillStyle = '#ff000080'
      ctx.fillRect(x + 1.5, y + 1.5, 1, 1)
      await sleep(1)
    }
  }
}

const combineWalls = map => {
  let best = null
  let maxSize = 0
  for (let [x, y, r] of map.entries()) {
    if (r !== 1) continue
    let size = 1
    loop: while (map.has(x + size, y + size)) {
      for (let v = 0; v <= size; v++)
        if (map.get(x + size, y + v) !== 1
         || map.get(x + v, y + size) !== 1)
          break loop
      size++
    }
    if (size > maxSize) {
      maxSize = size
      best = { x, y }
    }
  }
  if (!best) return null
  for (let y = 0; y < maxSize; y++) {
    for (let x = 0; x < maxSize; x++) {
      map.set(best.x + x, best.y + y, 0)
    }
  }
  map.walls.push({ x: best.x, y: best.y, width: maxSize, height: maxSize, }) 
}

const mergeWalls = async (map, debug) => {
  for (let x = 0; x < map.width; x++) {
    for (let y = 0; y < map.height; y++) {
      if (map.get(x, y) !== 1) continue
      let chunk = { x, y, width: 0, height: 1 }
      while (map.get(x + chunk.width, y) === 1) {
        map.set(x + chunk.width, y, 0)
        chunk.width++
        
        map.walls.push(chunk)
        placeWalls(map, 1)
        if (debug) await sleep(10)
      }
      outer: while (true) {
        for (let i = 0; i < chunk.width; i++) {
          if (map.get(x + i, y + chunk.height) !== 1) break outer
        }
        for (let i = 0; i < chunk.width; i++)
          map.set(x + i, y + chunk.height, 0)
        chunk.height++
        
        map.walls.push(chunk)
        placeWalls(map, 1)
        if (debug) await sleep(10)
      }
      map.walls.push(chunk)
    }
  }
}

const wrapping = (x, y, map) => {
  return {
    x: x === 0 ? map.width  - 2 : x === map.width  - 1 ? 1 : x,
    y: y === 0 ? map.height - 2 : y === map.height - 1 ? 1 : y,
  }
}

const Maze = class {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.array = Array(width * height).fill(0)
    for (let [x, y, r] of this.entries().filter(([x, y, r]) => !this.has(x, y) ))
      this.set(x, y, 0)
    this.walls = []
  }
  get(x, y) {
    return this.array[y * this.width + x]
  }
  set(x, y, value) {
    this.array[y * this.width + x] = value
  }
  entries() {
    return this.array.map((value, i) => [i % this.width, Math.floor(i / this.width), value])
  }
  has(x, y) {
    return x > 0 && x < this.width - 1 && y > 0 && y < this.height - 1
  }
}

const SeedMaze = class {
  constructor({width, height, seedAmount, straightChance, turnChance, mazeSeed, debug}) {
    this.map = new Maze(width, height)
  
    if (mazeSeed === '') {
      this.mazeSeed = Math.floor(Math.random() * 2147483646)
    } else if (/^\d+$/.test(mazeSeed)) {
      this.mazeSeed = parseInt(mazeSeed)
    } else {
      this.mazeSeed = cyrb53(mazeSeed)
    }
    this.mapSeed = new Seed(this.mazeSeed)    
    
    this.seeds = []
    this.seedAmount = seedAmount
    this.turnChance = turnChance
    this.straightChance = straightChance
    
    this.debug = debug
  }
  async init() {
    await this.seedWalls()
    await this.growWalls()
    await findPockets(this.map, this.debug)
    let walls = this.map.array.filter(r => r === 1)
    await mergeWalls(this.map, this.debug)

    await placeWalls(this.map)
    return [walls, this.mazeSeed]
  }
  async validateCell(position) {
    if (this.map.get(position.x, position.y) === 1) return false
    if (!this.map.has(position.x, position.y)) return false
    return true
  }
  async seedWalls() {
    let i = 0
    
    while (this.seeds.length < this.seedAmount) {
      if (i > 1000) throw Error('Loop overflow')
      i++
      let loc = { x: 0, y: 0 }
      loc.x = Math.floor(this.mapSeed.nextFloat() * this.map.width) - 1
      loc.y = Math.floor(this.mapSeed.nextFloat() * this.map.height) - 1
      if (await this.validateCell(loc)) {
        this.seeds.push(loc)
        this.map.set(loc.x, loc.y, 1)
        await placeWalls(this.map, this.debug ? 0 : -1)
      }
    }
  }
  async growWalls() {
    let perpendicular = ([x, y]) => [[y, -x], [-y, x]]
    for (let seed of this.seeds) {
      let dir = direction[Math.floor(this.mapSeed.nextFloat() * 4)]
      while(true) {
        let [x, y] = dir
        if (this.mapSeed.nextFloat() <= this.straightChance) {
          seed.x += x
          seed.y += y
        } else if (this.mapSeed.nextFloat() <= this.turnChance) {
          let [xx, yy] = perpendicular(dir)[Math.floor(this.mapSeed.nextFloat() * 2)]
          seed.x += xx
          seed.y += yy
        } else {
          break
        }
        if (await this.validateCell(seed)) {
          this.map.set(seed.x, seed.y, 1)
          await placeWalls(this.map, this.debug ? 0 : -1)
        } else {
          break
        }
      }
    }
  }
}  
  
let running = false
  
run.onclick = async () => {
  if (!running) {
    running = true
    pixelSize = Math.floor(41 / 41 * 13)
    canvas.width = 555
    canvas.height = 555
    ctx.scale(pixelSize, pixelSize)
    ctx.roundRect(1, 1, 41, 41, 0.75)
    ctx.lineWidth = 0.95
    ctx.strokeStyle = '#797979'
    ctx.fillStyle = '#cdcdcd'
    ctx.fill()
    ctx.stroke()
    let map = new SeedMaze({
      width: 40,
      height: 40,
      seedAmount: 100,
      straightChance: 0.75,
      turnChance: 0.25,
      mazeSeed: document.getElementById('input').value,
      debug: document.getElementById('debug').checked,
    })
    
    let [ maze, seed ] = await map.init()
    
    document.getElementById('seed').textContent = seed
    document.getElementById('image').setAttribute('download', `seed_maze_${seed}.png`)
    
    running = false
    alreadyPlaced.length = 0
  }
}

download.onclick = () => {
  let download = document.getElementById('image')
  let image = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream')
  download.setAttribute('href', image)
  download.click()
}
