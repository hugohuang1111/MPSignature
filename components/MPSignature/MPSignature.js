// components/MPSignature/MPSignature.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    fillStyle: {
      type: String,
      value: '#000'
    },
    backgroundColor: {
      type: String,
      value: '#EEE'
    },
    penPointRadius: {
      type: Number,
      value: 6
    },
    clipping: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    points: [], // 最新的三个触摸点

    clippingArea: {
      lt: { x: -1, y: -1},  // left-top point of clipping rectangle
      rb: { x: -1, y: -1}   // right-bottom point of clipping rectangle
    },

    writeFlag: false,  // 标识用户是否手写过, 只以有没有收到触摸事件为准

    bezierControlFactorA: 0.25, //计算贝塞尔曲线开始锚点的控制点的因子
    bezierControlFactorB: 0.25, //计算贝塞尔曲线结束锚点的控制点的因子
  },

  pageLifetimes: {
    show: function() {
      this.onShow();
    },
    hide: function() {
      // 页面被隐藏
    },
    resize: function(size) {
      // 页面尺寸变化
    }
  },

  lifetimes: {
    attached: function() {
      this.onAttached();
    },
    detached: function() {
      this.onDetached();
    },
  },

  attached: function() {
    this.onAttached();
  },
  detached: function() {
    this.onDetached();
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onAttached: function() {
      this.queryCanvas();
    },
    onDetached: function() {
    },
    onShow: function() {
    },
    onCanvasTouchStart: function(e) {
      if (e.type != 'touchstart') return false;
      if (0 == e.touches.length) { return; }

      // 新的一笔开始，清空以前的点
      this.data.points = [];
      this.addPoint(this.evt2Point(e));
      //this.drawPoint(this.data.points[0]);
    },
    onCanvasTouchMove: function(e) {
      if (e.type != 'touchmove') return false;
      if (0 == e.touches.length) { return; }

      this.addPoint(this.evt2Point(e));
      this.draw();
    },
    onCanvasTouchEnd: function(e) {
      if (e.type != 'touchend') return;
      this.data.writeFlag = true;
      if (0 == e.touches.length) { return; }

      this.addPoint(this.evt2Point(e));
      this.draw();
      this.drawPoint(this.evt2Point(e));
    },

    queryCanvas: function() {
      const self = this;
      if (this.data.canvasContent) {
        return;
      }
      const query = this.createSelectorQuery()
      query.select('#mp-signature-board')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (null == res || null == res[0]) {
            console.log('ERROR, query canvas node failed');
            return;
          }
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          // console.log(`res W,H (${res[0].width},${res[0].height}), dpr: ${dpr}, canvas W,H (${canvas.width}, ${canvas.height})`);

          self.data.canvasW = canvas.width;
          self.data.canvasH = canvas.height;
          self.data.canvasContent = ctx;
          self.data.canvas = canvas;
          self.clearCanvas();
        });
    },

    clearCanvas: function() {
      const ctx = this.data.canvasContent;
      if (!ctx) {
        console.log('ERROR, canvas content is null');
        return;
      }

      ctx.fillStyle = this.properties.backgroundColor;
      ctx.fillRect(0, 0, this.data.canvasW, this.data.canvasH);
      ctx.fillStyle = this.properties.fillStyle;
      ctx.strokeStyle = this.properties.fillStyle;
      ctx.lineCap = "round";

      this.data.writeFlag = false;

      if (this.properties.clipping) {
        this.resetClippingArea();
      }
    },

    evt2Point: function(e) {
      const point = {
        time: new Date().getTime(),
        x: e.touches[0].x,
        y: e.touches[0].y
      };

      return point;
    },

    addPoint: function(point) {
      if (this.properties.clipping) {
        this.adjustClippingArea(point);
      }
      this.data.points.push(point);
      while (this.data.points.length > 3) {
        this.data.points.splice(0, 1);
      }
      this.calcLineWidth();
      //先用新的值, 计算出对应的贝塞尔曲线的控制点
      this.calcBezerCurve();

      /*
       * 如果要控制线条的粗细(现在是根据速度来判断应该粗一些还是细一点)
       * 那么就需要根据两点之间的距离来判断要不要取插值
       */
      if (this.bezierInterpolationIf()) {
        // 加了插值, 应该重新计算贝塞尔曲线的控制点
        this.calcBezerCurve();
      }
    },

    draw: function() {
      const points = this.data.points;
      if (null == points) {
        return;
      }
      if (1 == points.length) {
        this.drawPoint(points[0]);
      } else if (2 == points.length) {
        this.drawLine(points[0], points[1]);
      } else {
        this.drawCurves();
        // for (let i = 1; i < points.length - 1; i++) {
        //   this.drawCurve(points[i-1], points[i], points[i+1]);
        // }
      }
    },

    drawPoint: function(p0) {
      const ctx = this.data.canvasContent;
      if (!ctx) {
        console.log('ERROR, canvas content is null');
        return;
      }

      ctx.beginPath();      
      ctx.arc(p0.x, p0.y,
        p0.r ? p0.r : this.properties.penPointRadius * 0.8,
        0, Math.PI*2, true);
      ctx.closePath();
      ctx.fill();
    },

    drawLine: function(p0, p1) {
      const ctx = this.data.canvasContent;
      if (!ctx) {
        console.log('ERROR, canvas content is null');
        return;
      }
      ctx.lineWidth = p0.r ? p0.r : this.properties.penPointRadius;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p0.x, p0.y);
      ctx.stroke();
    },

    drawCurves: function() {
      const ctx = this.data.canvasContent;
      if (!ctx) {
        console.log('ERROR, canvas content is null');
        return;
      }
      const points = this.data.points;

      for (let i = 0; i < points.length - 2; i++) {
        ctx.lineWidth = points[i].r;
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.bezierCurveTo(
          points[i].ctlA.x, points[i].ctlA.y,
          points[i+1].ctlB.x, points[i+1].ctlB.y,
          points[i+1].x, points[i+1].y);
        ctx.stroke();
      }
      // ctx.fill();
      
    },

    drawCurve: function(p0, p1, p2) {
      const ctx = this.data.canvasContent;
      if (!ctx) {
        console.log('ERROR, canvas content is null');
        return;
      }
      if (!p0.ctlA || !p1.ctlB) {
        console.log('ERROR, bezier control point is null');
        return;
      }
      const dst = {
        x: p1.x,
        y: p1.y
      }
      if (dst.x > p0.x) { dst.x += 1; }
      if (dst.x < p0.x) { dst.x -= 1; }
      if (dst.y > p0.y) { dst.y += 1; }
      if (dst.y < p0.y) { dst.y -= 1; }

      ctx.beginPath();
      ctx.lineWidth = p0.r ? p0.r : this.properties.penPointRadius;
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p0.ctlA.x, p0.ctlA.y, p1.ctlB.x, p1.ctlB.y, dst.x, dst.y);
      ctx.stroke();
    },

    calcLineWidth: function() {
      const points = this.data.points;
      if (1 == points.length) {
        return;
      }
      this.calcPenPointRadius(points[0], points[1]);
      if (points.length > 2) {
        this.calcPenPointRadius(points[1], points[2]);
      }
    },

    calcPenPointRadius: function(a, b) {
      if (a.r) {
        return;
      }
      const d = this.distance(a, b);
      const t = b.time - a.time;
      let speed = d/t;

      const myEventDetail = {
        speed: speed
      }
      this.triggerEvent('Log', myEventDetail)

      const speedMin = 0.3;
      const speedMax = 2;
      // 创建速度 speedMin 到 speedMax 的范围与
      // 线宽 0.5*this.properties.penPointRadius 到 2*this.properties 的一一映射关系
      if (speed < speedMin) { speed = speedMin; }
      if (speed > speedMax) { speed = speedMax; }
      const v = (speedMax - speed)/(speedMax - speedMin);
      a.r = this.properties.penPointRadius * 0.5 + this.properties.penPointRadius * 1.5 * v;
    },
  
    distance: function(a, b) {
      const x = b.x - a.x;
      const y = b.y - a.y;
      return Math.sqrt(x * x + y * y);
    },

    calcBezerCurve: function() {
      const points = this.data.points;
      if (1 == points.length) {
        return;
      }
      this.calcBezierCurveControlPoint(points[0], points[0], points[1],
        this.data.bezierControlFactorB, this.data.bezierControlFactorA);
      if (2 == points.length) {
          return;
      }
      for(let i = 1; i < points.length - 1; i++) {
        this.calcBezierCurveControlPoint(points[i-1], points[i], points[i+1],
          this.data.bezierControlFactorB, this.data.bezierControlFactorA);
      }
    },

    /*
     * 这里是在给出的三个确定的点后，计算中间点在两个方向上的贝塞尔曲线的控制点,
     * p0与p1之间的贝塞尔曲线的 p1 处的控制点 controlB
     * p1与p2之间的贝塞尔曲线的 p1 处的控制点 controlA
     * 
     * 这个文章介绍了如何在已知的情况下，计算对应点的控制点
     * https://wenku.baidu.com/view/c790f8d46bec0975f565e211.html
     * 
     */
    calcBezierCurveControlPoint: function(p0, p1, p2, vb, va) {
      const ctlB = {
        x: p1.x - vb * (p2.x - p0.x),
        y: p1.y - vb * (p2.y - p0.y)
      };
      const ctlA = {
        x: p1.x + va * (p2.x - p0.x),
        y: p1.y + va * (p2.y - p0.y)
      };
      p1.ctlB = ctlB;
      p1.ctlA = ctlA;
    },

    bezierInterpolationIf: function() {
      const points = this.data.points;
      if (points.length < 3) {
        return false;
      }
      const d = this.distance(points[0], points[1]);
      const bestD = 5; // 以bestD为值, 查应该取多少插值
      if (d < bestD) {
        // 距离近, 不需要插值
        return false;
      }
      
      const n = Math.ceil(d/bestD);
      const r = (points[1].r - points[0].r)/(n + 1);

      const newPoints = this.calcBezierInterpolation(points[0], points[0].ctlA, points[1].ctlB, points[1], n);
      newPoints.forEach(function(p, i) {
        p.r = points[0].r + r * (i + 1);
      });
      points.splice(1, 0, ...newPoints);
      points[0].ctlA = null;
      points[newPoints.length + 1].ctlB = null;

      // console.log('bezier interpolation:' + JSON.stringify(points));

      return true;
    },

    /*
     * 三阶贝塞尔取样插值
     * p0, p3 为曲线的锚点也就是开始，结束点
     * p1, p2 为控制点, p1 为 p0 上的控制点, p2 为 p3 上的控制点
     * n 要取样的插件数
     */
    calcBezierInterpolation: function(p0, p1, p2, p3, n) {
      const points = [];
      const interpolation = function(p0, p1, p2, p3, t) {
        // 三阶贝塞尔曲线的公式
        return (1-t)*(1-t)*(1-t)*p0 + 3*(1-t)*(1-t)*t*p1 + 3*(1-t)*t*t*p2 + t*t*t*p3;
      }
      /*
       * 取样 n 份, 那就应该分成 n + 1 段
       */
      for (let i = 0; i < n; i++) {
        const t = (i + 1)/(n + 1) // 等同于 1 / (n + 1) * (i + 1);
        points.push({
          x: interpolation(p0.x, p1.x, p2.x, p3.x, t),
          y: interpolation(p0.y, p1.y, p2.y, p3.y, t)
        });
      }

      return points;
    },

    test: function() {
      const time = new Date().getTime();
      let points = [
        {
          time: time,
          x: 10,
          y: 10
        },
        {
          time: time + 100,
          x: 100,
          y: 100
        },
        {
          time: time + 500,
          x: 110,
          y: 110
        }
      ];

      points = [
        {
          "time":1598791103767,
          "x":313,
          "y":138
        },
        {"time":1598791104204,"x":326.09375,"y":145.75},
        {"time":1598791104220,"x":326.40234375,"y":145.90234375},
        {"time":1598791104237,"x":326.62890625,"y":146.0546875},
        {"time":1598791104239,"x":326.85546875,"y":146.12890625},
        {"time":1598791104267,"x":327.08203125,"y":146.203125},
        {"time":1598791104268,"x":327.15234375,"y":146.2734375},
        {"time":1598791104290,"x":327.37890625,"y":146.34765625},
        {"time":1598791104292,"x":327.52734375,"y":146.421875},
        {"time":1598791104307,"x":327.75390625,"y":146.49609375},
        {"time":1598791104308,"x":327.98046875,"y":146.6484375},
        {"time":1598791104330,"x":328.20703125,"y":146.72265625},
        {"time":1598791104332,"x":328.43359375,"y":146.796875},
        {"time":1598791104361,"x":328.58203125,"y":146.9453125},
        {"time":1598791104362,"x":328.80859375,"y":147.09765625},
        {"time":1598791104368,"x":328.87890625,"y":147.16796875},
        {"time":1598791104393,"x":329.02734375,"y":147.2421875},
        {"time":1598791104394,"x":329.09765625,"y":147.2421875},
        {"time":1598791104409,"x":329.16796875,"y":147.3125},
        {"time":1598791104587,"x":329.16796875,"y":147.3828125}
      ]

      const self = this;
      this.data.points = [];
      points.forEach(function(point) {
        self.addPoint(point);
      });
      this.draw();
    },

    resetClippingArea: function() {
      this.data.clippingArea = {
        lt: { x: -1, y: -1},
        rb: { x: -1, y: -1}
      };
    },

    isClippingAreaValid: function() {
      const clipArea = this.data.clippingArea;
      if (-1 == clipArea.lt.x) {
        return false;
      }
      return true;
    },

    adjustClippingArea: function(point) {
      const lt = this.data.clippingArea.lt;
      const rb = this.data.clippingArea.rb;
      if (!this.isClippingAreaValid()) {
        lt.x = point.x;
        lt.y = point.y;
        rb.x = point.x;
        rb.y = point.y;
        return;
      }
      if (point.x < lt.x) { lt.x = point.x; }
      if (point.x > rb.x) { rb.x = point.x; }
      if (point.y < lt.y) { lt.y = point.y; }
      if (point.y > rb.y) { rb.y = point.y; }
    },

    getClippingRect: function() {
      if (!this.isClippingAreaValid()) {
        return null;
      }
      return {
        x: this.data.clippingArea.lt.x,
        y: this.data.clippingArea.lt.y,
        w: this.data.clippingArea.rb.x - this.data.clippingArea.lt.x,
        h: this.data.clippingArea.rb.y - this.data.clippingArea.lt.y
      }
    },

    genSignatureImg: function(cb) {
      if (!cb) return;
      if (!this.data.writeFlag) {
        cb(2, 'user have not signature');
        return;
      }
      const self = this;
      const params = {
        destWidth: this.data.canvasW,
        destHeight: this.data.canvasH,
        canvas: this.data.canvas,
        success(res) {
          cb (0, res.tempFilePath);
        },
        fail(res) {
          cb (1, res);
        }
      };
      if (this.properties.clipping) {
        const clipRect = this.getClippingRect();
        if (null != clipRect) {
          const padding = 10;
          params.x = clipRect.x - padding;
          params.y = clipRect.y - padding;
          params.width = clipRect.w + padding * 2;
          params.height = clipRect.h + padding * 2;
          params.destWidth = params.width;
          params.destHeight = params.height;
        }
      }
      wx.canvasToTempFilePath(params);
    }


  },

})
