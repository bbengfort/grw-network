(function() {

  cross = function(a, b) {
    return a[0] * b[1] - a[1] * b[0];
  }

  dot = function(a, b) {
    return a[0] * b[0] + a[1] * b[1];
  }

  GRWGraph = function() {

    // Important Variables
    this.mpos    = null;
    this.rotate  = 0;
    this.url     = "/data/test-data.json";

    // D3 Layout
    this.splines = [];
    this.cluster = null;
    this.bundle  = null;
    this.line    = null;

    // Elements
    this.elem    = null;
    this.svg     = null;

    this.init = function(selector) {

      this.elem = d3.select(selector);

      var self  = this;
      var bbox  = self.bbox();

      this.cluster = d3.layout.cluster()
        .size([360, (bbox.ry - 180)])
        .sort(function(a,b) { return d3.ascending(a.key, b.key); });

      this.bundle  = d3.layout.bundle();
      this.line    = d3.svg.line.radial()
        .interpolate("bundle")
        .tension(0.85)
        .radius(function(d) { return d.y; })
        .angle(function(d) { return d.x / 180 * Math.PI; });

      this.svg = this.elem.append("svg:svg")
          .attr("width", bbox.width)
          .attr("height", bbox.height)
        .append("svg:g")
          .attr("transform", "translate(" + bbox.rx + "," + bbox.ry + ")");

      this.svg.append("svg:path")
        .attr("class", "arc")
        .attr("d", d3.svg.arc().outerRadius(bbox.ry - 180).innerRadius(0).startAngle(0).endAngle(2 * Math.PI))
        .on("mousedown", self.mousedown(self));

      // Fetch and load the data
      this.load_data(function() {
        // Bind event handlers
        d3.select(window)
          .on("mousemove", self.mousemove(self))
          .on("mouseup", self.mouseup(self));

        d3.select("input[type=range]").on("change", function(e) {
          self.line.tension(this.value / 100);
          self.path.attr("d", function(d,i) { return self.line(self.splines[i]); });
        });

        console.log("Graph application started and ready");
      });

      // Return this for chaining
      return this;
    }

    this.mouse = function(e) {
      var bbox = this.bbox();
      return [e.pageX - bbox.rx, e.pageY - bbox.ry]
    }

    this.mousedown = function(self) {
      return function(e) {
        self.mpos = self.mouse(d3.event);
        d3.event.preventDefault();
      }
    }

    this.mousemove = function(self) {
      return function(e) {
        if (self.mpos) {
          var bbox  = self.bbox()
          var rx    = bbox.rx;
          var ry    = bbox.ry;
          var mpos  = self.mpos;
          var mdis  = self.mouse(d3.event);
          var delta = Math.atan2(cross(mpos, mdis), dot(mpos, mdis)) * 180 / Math.PI;
          self.elem.style("-webkit-transform", "translate3d(0," + (ry - rx) + "px,0)rotate3d(0,0,0," + delta + "deg)translate3d(0," + (rx - ry) + "px,0)");
        }
      };
    }

    this.mouseup = function(self) {
      return function(e) {
        if (self.mpos) {
          var bbox  = self.bbox()
          var rx    = bbox.rx;
          var ry    = bbox.ry;
          var mdis  = self.mouse(d3.event);
          var delta = Math.atan2(cross(self.mpos, mdis), dot(self.mpos, mdis)) * 180 / Math.PI;

          self.rotate += delta;
          if (self.rotate > 360) self.rotate -= 360;
          else if (self.rotate < 0) self.rotate += 360;
          self.mpos = null;

          self.elem.style("-webkit-transform", "rotate3d(0,0,0,0deg)");

          self.svg.attr("transform", "translate(" + rx + "," + ry + ")rotate(" + self.rotate + ")")
            .selectAll("g.node text")
              .attr("dx", function(d) { return (d.x + self.rotate) % 360 < 180 ? 25 : -25; })
              .attr("text-anchor", function(d) { return (d.x + self.rotate) % 360 < 180 ? "start" : "end"; })
              .attr("transform", function(d) { return (d.x + self.rotate) % 360 < 180 ? null : "rotate(180)"; });
        }
      }
    }

    this.mouseover = function(self) {

      return function(d) {
        self.svg.selectAll("path.link.target-" + d.key)
          .classed("target", true)
          .each(self.updateNodes("source", true));

        self.svg.selectAll("path.link.source-" + d.key)
          .classed("source", true)
          .each(self.updateNodes("target", true));
      }
    }

    this.mouseout = function(self) {

      return function(d) {
        self.svg.selectAll("path.link.source-" + d.key)
          .classed("source", false)
          .each(self.updateNodes("target", false));

        self.svg.selectAll("path.link.target-" + d.key)
          .classed("target", false)
          .each(self.updateNodes("source", false));
      }
    }

    this.updateNodes = function(name, value) {
      var self = this;
      return function(d) {
        if (value) this.parentNode.appendChild(this);
        self.svg.select("#node-" + d[name].key).classed(name, value);
      };
    }

    this.load_data = function(callback) {
      var self = this;

      d3.json(self.url, function(data) {
        var bbox     = self.bbox();
        var nodes    = self.cluster.nodes(packages.root(data));
        var links    = packages.imports(nodes);
        self.splines = self.bundle(links);

        self.path = self.svg.selectAll("path.link")
            .data(links)
          .enter().append("svg:path")
            .attr("class", function(d) { return "link source-" + d.source.key + " target-" + d.target.key; })
            .attr("d", function(d,i) { return self.line(self.splines[i]); });

        var groupData = self.svg.selectAll("g.group")
            .data(nodes.filter(function(d) { return (d.key == 'Jobs' || d.key == 'Freelance' || d.key == 'Bayard') && d.children; }))
          .enter().append("group")
            .attr("class", "group");

        var groupArc = d3.svg.arc()
          .innerRadius(bbox.ry - 177)
          .outerRadius(bbox.ry - 167)
          .startAngle(function(d) { return (findStartAngle(d.__data__.children)-2) * Math.PI / 180;})
          .endAngle(function(d) { return (findEndAngle(d.__data__.children)+2) * Math.PI / 180});

        self.svg.selectAll("g.arc")
            .data(groupData[0])
          .enter().append("svg:path")
            .attr("d", groupArc)
            .attr("class", "groupArc")
            .style("fill", "#1f77b4")
            .style("fill-opacity", 0.5);

        self.svg.selectAll("g.node")
            .data(nodes.filter(function(n) { return !n.children; }))
          .enter().append("svg:g")
            .attr("class", "node")
            .attr("id", function(d) { return "node-" + d.key; })
            .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + d.y + ")"; })
          .append("svg:text")
            .attr("dx", function(d) { return d.x < 180 ? 25 : -25; })
            .attr("dy", ".31em")
            .attr("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
            .attr("transform", function(d) { return d.x < 180 ? null : "rotate(180)"; })
            .text(function(d) { return d.key.replace(/_/g, ' '); })
            .on("mouseover", self.mouseover(self))
            .on("mouseout", self.mouseout(self));

        // Call the callback handler if it's there
        if (callback) callback();
      });
    }

    this.bbox = function() {
      var box = this.elem.node().getBoundingClientRect();
      box.rx  = box.width / 2;
      box.ry  = box.height / 2;

      return box;
    }

  };

  findStartAngle = function(children) {
    var min = children[0].x;
    children.forEach(function(d) {
       if (d.x < min)
           min = d.x;
    });
    return min;
  }

  findEndAngle = function(children) {
    var max = children[0].x;
    children.forEach(function(d) {
       if (d.x > max)
           max = d.x;
    });
    return max;
  }

})();
