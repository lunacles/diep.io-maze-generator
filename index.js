let run = document.getElementById('run')
let status = document.getElementById('status')
let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d')
let width = 40
let height = 40
let pixelSize = 10
canvas.width = pixelSize * width
canvas.height = pixelSize * height
ctx.scale(pixelSize, pixelSize)

const Maze = class {
  static direction = [
    [-1, 0], [1, 0], // left and right
    [0, -1], [0, 1], // up and down
  ]
  constructor(width, height, [min, dev], turnChance, branchChance, terminationChance, wallWrapping) {
    this.width = width
    this.height = height
    this.map = Array(this.width * this.height).fill(0) // 1D Array
    this.seeds = []
    this.seedAmount = Math.floor(Math.random() * dev) + min
    this.turnChance = turnChance
    this.branchChance = branchChance
    this.terminationChance = terminationChance
    this.wallWrapping = wallWrapping
    this.walls = []
  }
  get(x, y) {
    return this.map[y * this.width + x]
  }
  set(x, y, value) {
    this.map[y * this.width + x] = value
  }
  mapValues() {
    return this.map.map((r, i) => [i % this.height, Math.floor(i / this.width), r])
  }
  init() {
    this.seedWalls(this.seedAmount)
    this.growWalls()
    this.sprinkleWalls()
    for (let [x, y, r] of this.findPockets())
      this.set(x, y, 1)
    
    this.combine()
    for (let {x, y, width, height} of this.walls) {
      ctx.fillStyle = '#cdcdcd'
      ctx.fillRect(x + 2, y + 2, width, height)
      
      ctx.strokeStyle = '#00000080'
      ctx.lineWidth = 0.01
      ctx.fillStyle = '#9f9f9f80'
      ctx.fillRect(x + 2, y + 2, width, height)
      ctx.strokeRect(x + 2, y + 2, width, height)
    }
  }
  combine() {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.get(x, y) !== 1) continue
        let chunk = { x, y, width: 0, height: 1 }
        while (this.get(x + chunk.width, y) === 1) {
          this.set(x + chunk.width, y, 0)
          chunk.width++
        }
        outer: while (true) {
          for (let i = 0; i < chunk.width; i++) {
            if (this.get(x + i, y + chunk.height) !== 1) break outer
          }
          for (let i = 0; i < chunk.width; i++)
            this.set(x + i, y + chunk.height, 0)
          chunk.height++
        }
        this.walls.push(chunk)
      }
    }
  }
  createWall(x, y) {
    if (x <= 0 || y <= 0 || x >= this.width - 1 || y >= this.height - 1 || this.get(x, y) === 1) return
    this.set(x, y, 1)
  }
  seedWalls(seedAmount) {
    for (let i = 0; i < 10000; i++) {
      if (this.seeds.length >= seedAmount) break
      let loc = { x: 0, y: 0 }
      loc.x = Math.floor((Math.random() * this.width) - 1) 
      loc.y = Math.floor((Math.random() * this.height) - 1)
      //if (this.seeds.length === 0) this.seeds.push(loc)
      if (this.seeds.some(a => (Math.abs(loc.x - a.x) <= 2 && Math.abs(loc.y - a.y) <= 2))) continue
      if (loc.x === 0 || loc.y === 0 || loc.x === this.width - 1 || loc.y === this.height - 1) continue
      this.seeds.push(loc)
    }
    for (let seed of this.seeds)
      this.createWall(seed.x, seed.y)
  }
  sprinkleWalls() {
    for (let i = 0; i < 5; i++) { 
      let loc = { x: 0, y: 0 }
      loc.x = Math.floor((Math.random() * this.width) - 1) 
      loc.y = Math.floor((Math.random() * this.height) - 1)
      if (this.mapValues().some(([x, y, r]) => r === 1 && (Math.abs(loc.x - x) <= 3 && Math.abs(loc.y - y) <= 3))) continue
      if (loc.x <= 0 || loc.y <= 0 || loc.x >= this.width || loc.y >= this.height) continue
      this.createWall(loc.x, loc.y)
    }
  }
  growWalls() { 
    for (let [i, seed] of this.seeds.entries()) {
      let dir = Maze.direction[Math.floor(Math.random() * 4)]
      let termination = 1
      while (termination >= this.terminationChance) {
        termination = Math.random()
        let [x, y] = dir
        seed.x += x
        seed.y += y
        if (this.wallWrapping) {
          seed.x = seed.x === 0 ? this.width : seed.x === this.width ? 1 : seed.x
          seed.y = seed.y === 0 ? this.height : seed.y === this.height ? 1 : seed.y
        }
        this.createWall(seed.x, seed.y)
        if (Math.random() <= this.branchChance) {
          if (this.seeds.length > 75) continue
          let [ xx, yy ] = Maze.direction.filter(a => a.every((b, c) => b !== dir[c]))[Math.floor(Math.random() * 2)]
          this.seeds.push({ x: seed.x + xx, y: seed.y + yy })
          this.createWall(seed.x + xx, seed.y + yy)
        } else if (Math.random() <= this.turnChance) {
          dir = Maze.direction.filter(a => a.every((b, c) => b !== dir[c]))[Math.floor(Math.random() * 2)]
        }
      }
    }
  }
  findPockets() {
    let queue = [[0, 0]]
    this.set(0, 0, 2)
    let checkedIndices = new Set([0])
    for (let i = 0; i < 3000 && queue.length > 0; i++) {
      let [x, y] = queue.shift()
      for (let [nx, ny] of [
        [x - 1, y], // left
        [x + 1, y], // right
        [x, y - 1], // top
        [x, y + 1], // bottom
      ]) {
        if (!(nx >= 0 && nx < this.width && ny >= 0 && ny < this.height)) continue
        if (this.get(nx, ny) !== 0) continue
        let i = ny * this.width + nx
        if (checkedIndices.has(i)) continue
        checkedIndices.add(i)
        queue.push([nx, ny])
        this.set(nx, ny, 2)
      }
    }
    return this.mapValues().filter(([x, y, r]) => r === 0)
  }
  translateArray() {
    this.mapValues().map(([x, y, r]) => r === 1 ? this.set(x, y, true) : this.set(x, y, false))
    let output = Array(this.height).fill().map(a => new Array(this.width).fill(null))
    let x = 0
    let y = 0
    for (let [i, value] of this.map.entries()) {
      x = i % this.height
      y = Math.floor(i / this.width)
      output[y][x] = value
    }
    output.map(r => r.unshift(false))
    output.map(r => r.push(false))
    output.unshift(Array(this.width + 2).fill(false))
    output.push(Array(this.width + 2).fill(false))
    return output
  }
}
run.onclick = () => {
  pixelSize = Math.floor(41 / 41 * 10)
  canvas.width = 500
  canvas.height = 500
  ctx.scale(pixelSize, pixelSize)
  ctx.roundRect(1, 1, 41, 41, 0.75)
  ctx.lineWidth = 0.75
  ctx.strokeStyle = '#797979'
  ctx.fillStyle = '#cdcdcd'
  ctx.fill()
  ctx.stroke()
  let map = new Maze(
    40, 40,     // Width & Height
    [30, 30],   // Minimum Seeds & Deviating Seed Amount
    0.25,       // Max Turns & Turn Chance
    0.10,       // Max Branches & Branch Chance
    0.15,       // Termination Chance
    false       // Wall Wrapping
  )
  map.init()
}
