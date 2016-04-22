$(document).ready(function(){

  function App() {
    var _app = this

    _app.getData()
  }

  App.prototype.getData = function() {
    var _app = this

    d3.csv("data/IHME_GBD_2013_OBESITY_PREVALENCE_1990_2013_Y2014M10D08.CSV", accessor, function(data) {
      _app.build(data)
    })

    //taking a subset of the data: youth and obesity only
    function accessor(d) {
      if(d.metric=="obese" && d.age_group=="2 to 19 yrs, age-standardized"){
        return {
          year: +d["year"],
          country : d.location_name,
          mean: +d["mean"],
          sex: d.sex
        }
      } else {
        return null
      }
    }
    
  }

  App.prototype.build = function(data) {
    var _app = this

    //find mins and maxes in data
    var extent = {x: d3.extent(data, function(d) { return d.year; }),
                  y: d3.extent(data, function(d) { return d.mean; })}

    //sort data by country and sex
    var nestedData = d3.nest()
        .key(function(d) { return d.country; })
        .key(function(d) { return d.sex; })
        .map(data, d3.map)

    //build chart
    var chartRef = new Chart(nestedData, '#main-content', extent)

    //add countries to dropdown
    new Dropdown(nestedData.keys(), '#countries-dropdown', chartRef)

    //add genders to tabs
    new Tabs(nestedData.values()[0].keys(), '#tabs', chartRef)

    $('#loader').fadeOut(1000)

  }


  /* CHART */

  function Chart(dataset,node,extent) {
    var _chart = this

    _chart.dataset = dataset
    _chart.node = node
    _chart.extent = extent
    _chart.savedYExtent = [
      _chart.extent.y[0],_chart.extent.y[1]
    ]

    _chart.init()
    _chart.build()
    _chart.populate()
  }

  Chart.prototype.init = function() {
    var _chart = this

    _chart.margin = {top: 20, right: 20, bottom: 30, left: 50}
    _chart.width = 960 - _chart.margin.left - _chart.margin.right
    _chart.height = 500 - _chart.margin.top - _chart.margin.bottom

    _chart.xScale = d3.scale.linear()
        .range([0, _chart.width])

    _chart.yScale = d3.scale.linear()
        .range([_chart.height, 0])

    _chart.xAxis = d3.svg.axis()
        .scale(_chart.xScale)
        .orient("bottom")
        .tickFormat(d3.format("d"))

    _chart.yAxis = d3.svg.axis()
        .scale(_chart.yScale)
        .orient("left");

    _chart.line = d3.svg.line()
        .x(function(d) { return _chart.xScale(d.year) })
        .y(function(d) { return _chart.yScale(d.mean) })

    //assign colors to genders
    var colors = ["#4682B4","#800080","#008000"]
    var genders = _chart.dataset.values()[0].keys()
    _chart.colors={}
    for(var i=0; i<genders.length; i++) {
      _chart.colors[genders[i]] = colors[i]
    }

    //start out with the first gender selected
    _chart.selectedSex = genders[0]

    //initialize empty d3 set
    _chart.selectedRegions = d3.set()

  }

  Chart.prototype.build = function() {
    var _chart = this

    _chart.svg = d3.select(_chart.node).append("svg")
        .attr("width", _chart.width + _chart.margin.left + _chart.margin.right)
        .attr("height", _chart.height + _chart.margin.top + _chart.margin.bottom)
      .append("g")
        .attr("transform", "translate(" + _chart.margin.left + "," + _chart.margin.top + ")")

    _chart.tooltip = d3.select("body").append("div") 
        .attr("class", "tooltip")       
        .style("opacity", 0);

    //scale axes
    _chart.xScale.domain(_chart.extent.x)
    _chart.yScale.domain(_chart.extent.y)

    //add axes
    _chart.svg.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0," + _chart.height + ")")
          .call(_chart.xAxis);

    _chart.svg.append("g")
        .attr("class", "y axis")
        .call(_chart.yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".7em")
        .style("text-anchor", "end")
        .text("Obesity Percentage");
  }

  Chart.prototype.populate = function() {
    var _chart = this

    //for each country. c = country name, d = data
    _chart.dataset.forEach(function(c,d){

      _chart.svg.append("path")
        .attr("class", "line")
        .attr("id", _chart.modifyString(c))
        .attr("d", _chart.line(d.get(_chart.selectedSex)))
        .attr("stroke",_chart.colors[_chart.selectedSex])
        .attr("data-name", c)
        .on("mouseover", function (e) {
            d3.select(this)
              .style("stroke-width",'3px')
              .attr("stroke","black")
            _chart.tooltip.transition()    
                .duration(200)    
                .style("opacity", .9);
            _chart.tooltip.html(this.getAttribute("data-name"))
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 22) + "px"); 
        })
        .on("mouseout", function (e) {
            d3.select(this)
              .style("stroke-width",'1.5px')
              .attr("stroke",_chart.colors[_chart.selectedSex])
            _chart.tooltip.transition()
                .duration(200)    
                .style("opacity", 0);
        })

      }); // end forEach
  }

  Chart.prototype.updateAllLines = function() {
    var _chart = this

    _chart.dataset.forEach(function(c,d){
      d3.select("#"+_chart.modifyString(c))
        .transition()
        .duration(200)
        .attr("d", _chart.line(d.get(_chart.selectedSex)))

    })
  }

  Chart.prototype.updateGender = function(sex) {
    var _chart = this

    _chart.dataset.forEach(function(c,d){
      d3.select("#"+_chart.modifyString(c))
        .transition()
        .duration(200)
        .attr("stroke",_chart.colors[sex])
        .attr("d", _chart.line(d.get(sex)))
    })
  }

  Chart.prototype.changeYScale = function() {
    var _chart = this    

    var yMin = _chart.extent.y[0];
    var yMax = _chart.extent.y[1];

    if(!_chart.selectedRegions.empty()){

      var maxes = []
      var mins = []

      _chart.selectedRegions.forEach(function(d) {

        var max = d3.max(_chart.dataset.get(d).values(), function(array) {
          return d3.max(array, function(dd) {
            return dd.mean
          })
        })
        var min = d3.min(_chart.dataset.get(d).values(), function(array) {
          return d3.min(array, function(dd) {
            return dd.mean
          })
        })

        maxes.push(max)
        mins.push(min)
      })
      yMax = d3.max(maxes)
      yMin = d3.min(mins)

    }

    //only scale if needed
    if(yMin!=_chart.savedYExtent[0] || yMax!=_chart.savedYExtent[1]){

      _chart.savedYExtent[0]=yMin
      _chart.savedYExtent[1]=yMax

      _chart.yScale.domain([yMin,yMax])
      d3.select(".y").transition().duration(200).call(_chart.yAxis)

      _chart.updateAllLines()
    }

    
  }

  Chart.prototype.modifyString = function(s) {
   return "line-id-"+s.replace(/\s|'|,+/g, '')
  }


  /* DROPDOWN */

  function Dropdown(vals, node, chartRef) {
    var _dropdown = this

    _dropdown.node = d3.select(node)
    _dropdown.vals = vals
    _dropdown.chartRef = chartRef
    _dropdown.hoverTimer = null;

    _dropdown.initHover()
    _dropdown.initSearch()
    _dropdown.populate()
  }

  Dropdown.prototype.initHover = function() {
    var _dropdown = this

    $('#select-country').hover(function(){

        _dropdown.hoverTimer=setTimeout(function() {
            $(this).children('.dropdown').slideDown(250)
        }.bind(this),150)
    
    }, function(){
    
        window.clearTimeout(_dropdown.hoverTimer)
        $(this).children('.dropdown').slideUp(150)
    });
  }

  Dropdown.prototype.initSearch = function() {
    var _dropdown = this

    var reverseVals = []
    for(var i = _dropdown.vals.length-1; i >= 0; i--) {
        reverseVals.push(_dropdown.vals[i]);
    }
    var highlightedItem = null;
    var enterIndex = 0

    $('#search_text').on('keyup', function(e) {
      var searchValue = $(this).val().toLowerCase()
      if(searchValue.length>0){
        var positiveResults = []
        //search through all countries
        reverseVals.forEach(function(c) {
          var index = c.toLowerCase().indexOf(searchValue)
          if(index==0){
            positiveResults.unshift(c)
          } else if (index>0) {
            positiveResults.push(c)
          }
        })

        //if enter is pressed, go through results
        if(e.keyCode == 13) {
          if(enterIndex<positiveResults.length-1){
            enterIndex++
          } else {
            enterIndex=0
          }
        } else {
          enterIndex=0
        }

        if(positiveResults.length<1){ //red border if no result
          this.style.border="2px solid #BB0000"
        } else { //highlight and scroll to result
          this.style.border="2px solid #1f7f5c"
          var listItem = $("#"+_dropdown.modifyId(positiveResults[enterIndex]))

          if(highlightedItem){ //un-highlight old result
            highlightedItem.style.backgroundColor="transparent" 
          }
          var newItem = listItem.find("span")[0]
          newItem.style.backgroundColor="rgb(64, 151, 119)"
          highlightedItem = newItem

          $('.dropdown-content').animate({
            scrollTop: $('.dropdown-content').scrollTop() + listItem.position().top
          },50)

        }
      } else { // if input is empty
        if(highlightedItem){
          highlightedItem.style.backgroundColor="transparent" 
        }
        $('.dropdown-content').animate({
          scrollTop: 0
        },50)
      }
    })
  }

  Dropdown.prototype.populate = function() {
    var _dropdown = this

    _dropdown.vals.forEach(function(c) {
      _dropdown.node
        .append("li")
        .attr("id",_dropdown.modifyId(c))
        .on("click",function () {
          _dropdown.trigger(this)
        })
        .append("a")
        .html("<img src='img/check.png' /><span>"+c+"</span>")
    })
    d3.select("#all")
      .on("click",function () {
        _dropdown.triggerAll(this)
      })
  }

  Dropdown.prototype.modifyId = function(s) {
   return "list-item-"+s.replace(/\s|'|,+/g, '')
  }

  Dropdown.prototype.trigger = function(element) {
    var _dropdown = this

    var e = $(element);
    if(e.hasClass("selected")){ //de-select one region
      e.removeClass('selected')
      _dropdown.chartRef.selectedRegions.remove(e.text())
      _dropdown.chartRef.changeYScale()
      _dropdown.hideElement(d3.select("#"+_dropdown.chartRef.modifyString(e.text())))
    } else { 
      e.addClass('selected')
      if($('#all').hasClass('selected')){ //remove all regions except selected
        $('#all').removeClass('selected')
        d3.selectAll(".line").each(function() {
          if(this.id==_dropdown.chartRef.modifyString(e.text())) {
            _dropdown.showElement(d3.select(this))
          } else {
            _dropdown.hideElement(d3.select(this))
          }
        });
        window.setTimeout(function() {
          _dropdown.chartRef.selectedRegions = d3.set()
          _dropdown.chartRef.selectedRegions.add(e.text())
          _dropdown.chartRef.changeYScale()
        },205)

      } else { //select one region
        _dropdown.chartRef.selectedRegions.add(e.text())
        _dropdown.chartRef.changeYScale()
        _dropdown.showElement(d3.select("#"+_dropdown.chartRef.modifyString(e.text())))
      }
    }

  }

  Dropdown.prototype.triggerAll = function(element) {
    var _dropdown = this
    
    var e = $(element);
    if(!e.hasClass("selected")){ // add all lines to chart
      e.addClass('selected').siblings().removeClass('selected')
      _dropdown.chartRef.selectedRegions = d3.set()
      _dropdown.chartRef.changeYScale()
      window.setTimeout(function() {
        d3.selectAll(".line").each(function() {
          _dropdown.showElement(d3.select(this))
        });
      },205)
      
    }
  }

  Dropdown.prototype.showElement = function(ele) {
    var _dropdown = this

    ele.style("display","block")
    window.setTimeout(function() {
      ele.style("opacity","1")
    },25)
  }

  Dropdown.prototype.hideElement = function(ele) {
    var _dropdown = this

    ele.style("opacity","0")
    window.setTimeout(function() {
      ele.style("display","none")
    },200)
  }


  /* TABS */
  
  function Tabs(names, node, chartRef) {
    var _tabs = this
    
    _tabs.names = names
    _tabs.num = names.length
    _tabs.node = d3.select(node)
    _tabs.chartRef = chartRef
    _tabs.slider = null

    _tabs.init(chartRef)
  }

  Tabs.prototype.init = function() {
    var _tabs = this;
    
    for(var i=0; i<_tabs.num; i++) {
      _tabs.node.append("div")
        .attr("class","tab horizontal layout center center-justified")
        .style("width",100/_tabs.num+"%")
        .html(_tabs.names[i])
        .on("click",function () {
          _tabs.trigger(this,_tabs.chartRef)
        })
    }
    _tabs.slider = _tabs.node.append("div")
        .attr("class","slider-bar")
        .style("width",100/_tabs.num+"%")
        .style("background-color",_tabs.chartRef.colors[_tabs.chartRef.selectedSex])
  }

  Tabs.prototype.trigger=function(ele) {
    var _tabs = this;

    _tabs.chartRef.selectedSex=ele.innerHTML
    var slider = _tabs.slider[0][0]
      slider.style.backgroundColor = _tabs.chartRef.colors[ele.innerHTML]
      slider.style.transform="translateX("+ele.offsetLeft+"px)"
      slider.style.webkitTransform="translateX("+ele.offsetLeft+"px)"
      slider.style.msTransform="translateX("+ele.offsetLeft+"px)"

    _tabs.chartRef.updateGender(ele.innerHTML)

  }


  new App() 

});