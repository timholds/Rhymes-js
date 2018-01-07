/* - TODO

- get the rest of the songs done
- playbar for easy scrubbing?
- clicking a sound plays rhyme pairs together

- */
var tune = function(opts){
   // Overall vars
   var data = null;
   opts.music = typeof opts.music == 'undefined' ? true : opts.music;
   var playSoundInterval = null;
   var isIOS = (/Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor)) || (/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
   var app = {
     init: function(){
       function processData(error,lyrics){
         // Clear any content
         $('#tunes-'+opts.container).empty();
         // Sanitize lyrics
         if(opts.file == 'bigpun'){
           lyrics[21].text = 'ña';
         }
        //  console.log(error,lyrics);
         if(error){
          //  console.log(error);
           return false;
         };
         opts.easing = Modernizr.touch ? '' : 'elastic';
         opts.speed = Modernizr.touch ? 100 : 400;
         opts.startSize = Modernizr.touch ? 1 : .3;
         data = {
           file: opts.file,
           container: opts.container,
           lyrics: lyrics,
           show: opts.show,
           title: opts.title,
           artist: opts.artist,
           music: opts.music,
           album: opts.album,
           easing: opts.easing,
           speed: opts.speed,
           startSize: opts.startSize,
           hedcut: opts.hedcut
         };
         // Create audio and lyric containers through handlebars
         app.handlebars(data);
         // Create the audio player and lyric functions
         if(opts.music){
           app.createLyrics(data);
         }
         // Create the viz to accompany it
         app.createViz(data);
         // Trigger resize to ensure swiper container properly sized
         $(window).trigger('resize');
              app.actions();
       };
       if(!$('#tunes-'+opts.container).hasClass('built')){
         if(typeof opts.data == 'undefined'){
           queue()
            .defer(d3.csv,'data/' + opts.source)
            .await(processData);
         } else {
           processData(false,opts.data)
         }
       } else if (opts.container == 'userviz'){
         processData(false,opts.data)
       }
       return this;
     },
     actions: function(){
      $('.pillbuttons span.button').on('click', function(){
        $('.pillbuttons span.button').removeClass('active');
        $(this).addClass('active');
        $('#submitpillbutton').removeClass('inactive');
      });
      $('textarea#lyrics').on('keypress', function(){
        $('.pillbuttons span.button').removeClass('active');
                $('#submitpillbutton').removeClass('inactive');
      });
      $('textarea#lyrics').on('paste', function(){
                $('#submitpillbutton').removeClass('inactive');

      });
     },
     handlebars: function(data){
       Handlebars.registerHelper('breakspace', function(linebreak,space) {
        var ret = space == 1 ? ' ' : '';
            ret += linebreak == 1 ? '<br />' : '';
        return ret;
      });
      Handlebars.registerHelper('highlight', function(d) {
       return data.file == 'hamilton' && d[data.container] == 1 ? 'active'  : '';
     });

       // Create the basic structure targeting #tunes-{{file}}
       var structureSource = $('#structure-template').html();
       var structureTemplate = Handlebars.compile(structureSource);
       var structureOutput = structureTemplate(data);
       $('#tunes-' + data.container).append(structureOutput);

       // Create audio player
       var audioSource = $('#audio-player-template').html();
       var audioTemplate = Handlebars.compile(audioSource);
       var audioOutput = audioTemplate(data);
       $('#audio-player-' + data.container).append(audioOutput);

       // Create lyrics container
       var lyricsSource = $('#lyrics-template').html();
       var lyricsTemplate = Handlebars.compile(lyricsSource);
       var lyricsOutput = lyricsTemplate(data);
       $('#lyrics-' + data.container).append(lyricsOutput);

       // Mmodify that output based on options
       if(opts.show){
        //  $('#tunes-' + data.container + ' .jp-controls').hide();
        //  $('#tunes-' + data.container + ' .standalone-play-pause').show().css('opacity',1);
        //  $('#tunes-' + data.container + ' .lyrics-container,#tunes-' + data.container + ' .lyrics-container span').addClass('active');
        }
        if(data.container == 'userviz'){
          $('#tunes-' + data.container + ' .lyrics-container,#tunes-' + data.container + ' .lyrics-container span').addClass('active');
        }
        // Force layout on Hamilton for iOS
        if(isIOS){
          if(data.container == 'hamilton2' || data.container == 'hamilton3' || data.container == 'hamilton4'){
            $('#tunes-'+data.container +' .audio-player').hide();
            $('#tunes-'+data.container +' .standalone-play-pause').css('opacity',1);
          }
        }
       // Add class to wrapper to prevent doubling up
       $('#tunes-'+data.container).addClass('built');
     },
     createViz: function(data){
       // Set vars that will change
       var margin,
           width,
           height,
           svg,
           unitWidth,
           unitHeight,
           rSize,
           x,
           y;

       var rotate = -45;

       var numberOfRows = 0; // Include zero based row
       var rowsArr = [];
       var numberOfBreaks = 0;
       var numberOfSyllables = data.lyrics.length;
       var wordSoundOffset = -5;
       // Get number of groups
       $.each(data.lyrics,function(i,d){
         d.classed = parseFloat(d.classed);
         d.shown = false;
         numberOfRows = d.classed > numberOfRows ? d.classed : numberOfRows;
         if(jQuery.inArray(d.classed,rowsArr) < 0){
           rowsArr.push(d.classed);
         }
         numberOfBreaks += d.linebreak;
       });

       numberOfRows++;

      function setVars(){
        margin = {
         	top:60,
         	right:30,
         	bottom:15,
         	left:30
         },
         width = $('#viz-'+data.container).width()-margin.left-margin.right;

         // Get height by subtracting .lede and lyric boxes from overall height
         var $parent = $('#tunes-'+data.container).parents('.swiper-slide');

        //  $('#viz-'+data.container).hide();
        var halfWindow = window.innerHeight*.5;
        //  height = halfWindow-30-margin.top-margin.bottom-15;
        // var startingHeight = window.innerHeight < 600 ? 150 : 200;
        height =  200 - margin.top-margin.bottom;

        wordSoundOffset = window.innerWidth < 620 ? -15 : -5;
        //  height = ($parent.height()-$parent.find('.swiper-content').outerHeight()-margin.top-margin.bottom-15)*.6;
        //  $('#viz-'+data.container).show();
        //  height = height < 200 ? 200 : height;
         // Calculate height and width based on number of rows and entries
         unitWidth = width/(numberOfSyllables);

         if(data.container == 'userviz'){
           rSize = unitWidth;
           height = rSize * numberOfRows;
           if(height > 400){
             height = 400;
             rSize = height/numberOfRows;
           }
         } else {
           unitHeight = (height/(numberOfRows));
           // Take smallest size for width/height
           rSize = unitHeight < unitWidth ? unitHeight : unitWidth;//*.65;//window.innerWidth < 500 ? 10 : window.innerWidth < 767 ? 12 : 15;
         }
         //  rSize = rSize;
        //  rSize = rSize > 30 ? 30 : rSize;
        // rSize = 15;

         // Axes
         xOffsetViz = (width-(numberOfSyllables*rSize))/2;
         x = d3.scale.linear().domain([0,numberOfSyllables]).range([0,numberOfSyllables*rSize]);
         if(window.innerWidth > 620){
           y = d3.scale.linear().domain([0,numberOfRows]).range([0,numberOfRows*rSize]);
         } else {
           y = d3.scale.linear().domain([0,numberOfRows]).range([0,height]);
         }

         // Adjust RSze
         rSize = rSize < 15 ? 15 : rSize;
      }

      setVars();


        // Viz-unit variables that don't change
        var maxOpacity = 0.8;
        var minOpacity = 0.25;
        var fullOpacity = 1;


        // function to Play sound
        function playSound(jumpTo,playFor,playTo,timecode){
          if(data.music){
            // console.log(d.timecode);
            // console.log($('#audio-player-'+data.container+ ' .jp-jplayer').data('jPlayer').status.duration);
            var $player = $('#audio-player-' + data.container + ' .jp-jplayer');
            // $player.jPlayer('stop');
            $player.jPlayer('playHead',parseInt(jumpTo,10));
            $player.jPlayer('play');
            // Instead, check playhead and stop when correct
            playSoundInterval = setInterval(function(){
              var currTime = $player.data('jPlayer').htmlElement.audio.currentTime;
              // console.log($player.data('jPlayer').status.currentTime,playTo);
              if(currTime >= playTo){
                $player.jPlayer('stop');
                clearInterval(playSoundInterval);
              }
            },10);

            // Timeout to stop
            // setTimeout(function(){
            //   $player.jPlayer('stop');
            // },990*playFor);
            // Make circle briefly pop
            // d3.selectAll('#viz-'+data.container + ' .viz-unit')
            //   .filter(function(d){
            //     var rowNum = d3.select(this.parentNode.parentNode).datum();
            //     // console.log(rowNum,d.classed,d.timecode,timecode);
            //     return rowNum == d.classed && d.timecode == timecode ? this : null;
            //   })
            //   .attr('transform','scale('+ 0.3 + ') rotate(' + rotate + ')')
            //     .transition().duration(data.speed).ease(data.easing)
            //   .attr('transform',function(d){
            //     return 'scale(1) rotate(' + rotate + ')';
            //   });
              // .each('end',function(){
              //   d3.select(this)
              //     .transition().duration(data.speed).ease(data.easing)
              //   .attr('r',function(d){
              //     return rSize;
              //   })
              // });
          } else {
            var rows = d3.selectAll('#viz-'+data.container+' .viz-row');
            rows
              .selectAll('.word-sound').select('text')
                .transition().duration(data.speed).ease(data.easing)
              .attr('transform',function(d){
                return d.timecode == timecode ? 'scale(1)' : 'scale(' + data.startSize + ')';
              })
              .attr('opacity',function(d){
                return d.timecode == timecode ? '1' : '0';
              });
          }
        }


        function resize(){
          if($(window).width() >= 991){
            var xOffset = 48;
          }
          else if(($(window).width() < 991) && ($(window).width() > 767)){
            var xOffset = 40;
          }
          else if(($(window).width() < 767) && ($(window).width() > 620)){
            var xOffset = 45;
          }

          else{
            // console.log("blah");
            var xOffset = 0 + margin.left;
          }

          setVars();
          d3.select('#viz-'+data.container + ' svg')
              .attr('width',width+margin.left+margin.right)
              .attr('height',height+margin.top+margin.bottom)
          svg
            .attr('transform','translate(' + (xOffsetViz+xOffset) + ',' + margin.top + ')');


          svg.selectAll('.viz-row')
            .attr('transform',function(d,i){
              return 'translate(' + (x(0)) + ',' + y(d) + ')';
            });

          var note = rows.selectAll('.note')
              .attr('class','note')
              .attr('transform',function(d,i){
                return 'translate(' + x(i) + ',' + 0 + ')';
              })

          note.selectAll('circle')
            .attr('r',rSize) //unitWidth/2

          svg.selectAll('.bg')
            .attr('width',width)
            .attr('height',height-rSize);

        }

        var svg = d3.select('#viz-'+data.container)
        	.append('svg')
        		.attr('width',width+margin.left+margin.right)
        		.attr('height',height+margin.top+margin.bottom)
        	.append('g')
        		.attr('transform','translate(' + margin.left + ',' + margin.top + ')')
            .on('mousedown',function(){
              // Start and stop playing
              if(data.music){
                var $player = $('#audio-player-' + data.container + ' .jp-jplayer');
                var $controls = $('#tunes-'+ data.container + ' .standalone-play-pause');
                if($player.data().jPlayer.status.paused){
                  // $player.jPlayer('play');
                  // $controls.find('.jp-play').show();
                  // $controls.find('.jp-pause').hide();
                } else {
                  $player.jPlayer('pause');
                  $controls.find('.jp-play').hide();
                  $controls.find('.jp-pause').show();
                }
              }
            });
        //BG
        var bg = svg.append('rect')
        .attr('class','bg')
        .attr('width',width)
        .attr('height',height-rSize)
        .attr('fill','transparent');
        // var max = d3.max(data.lyrics,function(d){ return parseFloat(d.timecode); });


        for(var j = 0; j <= numberOfRows; j++){
          var row = svg.selectAll('.viz-row')
            .data(rowsArr).enter()
          .append('g')
            .attr('class','viz-row')
            .attr('data-row',function(d){ return d; });
            // .attr('transform',function(d,i){
            //   var xOffset = i%2 == 0 ? unitWidth : 0;
            //   return 'translate(' + (x(0)+xOffset) + ',' + y(d) + ')';
            // });
        }

        // Add horizontal lines
            // Colored on the line
                      // var lines = svg.selectAll('.viz-row')
                      //   .append('g')
                      //     .attr('class','line')
                      //     .attr('transform','translate(0,' + (unitHeight/2) + ')');
                      //
                      // lines.append('rect')
                      //   .attr('width',width)
                      //   .attr('height',1)
                      //   .attr('data-classed',function(d,i){
                      //     return i;
                      //   });
            // Not colored off the line
              // var lines = svg.selectAll('.viz-row')
              //   .append('g')
              //     .attr('class','line')
              //     .attr('transform','translate(0,' + (unitHeight) + ')');
              //
              // lines.append('rect')
              //   .attr('width',width)
              //   .attr('height',1)
              //   .attr('fill','#636363')

        // Append sounds if exist
        if(typeof settings[data.file] !== 'undefined'){
          // Add sound prefixes
          var sounds = svg.selectAll('.viz-row')
            .append('g')
              .attr('class','sound')
              .attr('transform',function(){
                var x = 5+xOffsetViz;
                return 'translate(-'+ x + ',' + (rSize/2) + ')';
              })
            .on('mouseover',function(d){
              d3.select(this.parentNode).selectAll('.viz-unit')
                  .filter(function(d){
                    var rowNum = d3.select(this.parentNode.parentNode).datum();
                    return d.classed == rowNum && d.classed !=0 ? this : null;
                  })
                .attr('transform','scale(' + 0.3 + ') rotate(' + rotate + ')')
                  .transition().duration(data.speed).ease(data.easing)
                .attr('transform',function(d){
                  return 'scale(1) rotate(' + rotate + ')';
                });
            })
            .attr('opacity',0);
          sounds.append('text')
            .text(function(d,i){
              return settings[data.file].sounds[d];
            })
            .attr('data-classed',function(d,i){ return d; })
        }

        // Append Groups for each note
        var rows = svg.selectAll('.viz-row');
        var note = rows.selectAll('.note')
            .data(data.lyrics).enter()
              .append('g')
            .attr('class','note')
            .attr('transform',function(d,i){
              return 'translate(' + (x(i)) + ',' + (0) + ')';
            })
            .on('mouseover',function(){
              d3.select(this).select('.viz-unit')
                .attr('transform','scale(1.2) rotate(' + rotate + ')')
                .attr('opacity',fullOpacity)
            })
            .on('mouseout',function(){
              d3.select(this).select('.viz-unit')
                .attr('transform','scale(1) rotate(' + rotate + ')')
                .attr('opacity',maxOpacity)
            })
            .on('mousedown',function(d,i){
              if(d.classed != 0 && !(window.innerWidth < 500 && Modernizr.touch)){
                var jumpTo = 0;
                var duration = settings[data.file].duration;
                if(data.container != 'userviz'){
                  jumpTo = (d.timecode/duration)*100;
                }
                var playFor = typeof data.lyrics[i+1] === 'undefined' ? 1 : (data.lyrics[i+1].timecode-d.timecode);
                var playTo = typeof data.lyrics[i+1] === 'undefined' ? 1 : data.lyrics[i+1].timecode;
                playSound(jumpTo,playFor,playTo,d.timecode);
              }
            });

            // Click on word span to play sound as well. Writing this here because it's the same as funtion above
            $('#tunes-'+data.container+' .lyrics span,.lede-'+data.container+' span.pill').click(function(){
              if($(this).hasClass('active') && $(this).parent().css('opacity') != 0){
                var d = {
                  timecode: $(this).data('timecode')
                };
                var i = $(this).data('index');
                var jumpTo = 0;
                if(data.container != 'userviz'){
                  var duration = settings[data.file].duration;
                  jumpTo = (d.timecode/duration)*100;
                }
                var playFor = typeof data.lyrics[i+1] === 'undefined' ? 1 : (data.lyrics[i+1].timecode-d.timecode);
                var playTo = typeof data.lyrics[i+1] === 'undefined' ? 1 : data.lyrics[i+1].timecode;
                playSound(jumpTo,playFor,playTo,d.timecode);
              }
            });


        // Control playhead on main play button to jump to spot if needed
        // If not yet played, set playhead if this is an option
        $('#tunes-'+data.container+' .jp-play').click(function(){
          // if(!$('#tunes-'+data.container).hasClass('played')){
          // Check if specific playhead directions
          if(!isIOS && (typeof settings[data.file] != 'undefined' && typeof settings[data.file].playhead != 'undefined' && typeof settings[data.file].playhead[data.container] != 'undefined')){
            var d = {
              timecode: settings[data.file].playhead[data.container][0]
            };
            var $player = $('#audio-player-' + data.container + ' .jp-jplayer');
            var duration = settings[data.file].duration;
            var jumpTo = (d.timecode/duration)*100;
            // var playFor = settings[data.file].playhead[data.container][1]-d.timecode;
            // console.log('myresult',jumpTo,d.timecode);
            $player.jPlayer('playHead',parseInt(jumpTo,10));
            // $player.jPlayer('play',d.timecode);
            // $player.jPlayer('play');
            playSoundInterval = setInterval(function(){
              var currTime = $player.data('jPlayer').htmlElement.audio.currentTime;
              // console.log('ok',currTime);
              if(currTime >= settings[data.file].playhead[data.container][1]){
                $player.jPlayer('stop');
                clearInterval(playSoundInterval);
              }
            },10);
          }
          // }
        });
        // note.append('rect')
        //   .attr('width',unitWidth)
        //   .attr('height',unitHeight)
        //   .attr('fill','#bbb')
        //   .attr('class','active viz-unit')
        //   .attr('data-classed',function(d){
        //     if(d3.select(this.parentNode.parentNode).datum() == d.classed){
        //       return d.classed;
        //     } else {
        //       return 0;
        //     }
        //   });
        // Append linebreak


        // Append VERTICAL dashed lines


        var firstRow = rows.filter(function(d){
          return d == 0 ? this : null;
        });

        // Vertical lines
        if(data.container != 'introviz'){
          firstRow.selectAll('.note').filter(function(d,i){
            return d.linebreak == 1;
          }).append('path')
            .attr('class','break')
            .attr('data-timecode',function(d){ return d.timecode; })
            .attr('d','M ' + (rSize) + ' ' + (0) + ' L ' + (rSize) + ' ' + (height))
            .attr('stroke-dasharray',('1,1'))
            .attr('stroke','#999')
            .attr('opacity',function(){
              return data.show ? 1 : 0;
            });
          var firstRowLine = svg.append('path')
            .attr('class','break')
            .attr('d','M ' + (0) + ' ' + (0) + ' L ' + (0) + ' ' + (height))
            .attr('stroke-dasharray',('1,1'))
            .attr('stroke','#999')
            .attr('opacity',function(){
              return data.show ? 1 : 0;
            });
        }

        var wordSound = firstRow.selectAll('.note')
          .append('g')
            .attr('class','word-sound')
            .attr('transform','translate(0,'+ (wordSoundOffset) + ')');
        wordSound.append('text')
            .text(function(d){ return d.text; })
            .attr('data-timecode',function(d){ return d.timecode; })
            .attr('data-classed',function(d){ return d.classed; })
            .attr('class','word-sound')
            .attr('transform','scale(1)')
            .attr('opacity',0);

        // Connectors
            // var connectors = note
            //   .append('g')
            //     .attr('class','connector');
            // connectors
            //   .append('path')
            //     .attr('d',function(d,i){
            //       var rowNum = d3.select(this.parentNode.parentNode).datum();
            //
            //       var d = d3.select(this.parentNode).datum();
            //       // console.log(d[data.container] != 'undefined' , d[data.container] != '' , d.classed == rowNum)
            //       if(d[data.container] != 'undefined' && d[data.container] != '' && d.classed == rowNum){
            //         return 'M 0,10 L 0, 20'
            //       } else {
            //         return '';
            //       }
            //     })
            //     .attr('fill','blue')
            //     .attr('stroke','black')
                // .attr('stroke-width',3);


        // Diamond view
            // Append BG circle for highlights
            // note.filter(function(d){
            //   var rowNum = d3.select(this.parentNode).datum();
            //   return rowNum == d.classed && d[data.container] == 1;
            // })
            //   .append('circle')
            //   .attr('r',rSize*2)
            //   .attr('fill','white');
            // Append disamond rect
            note.filter(function(d,i){
              var rowNum = d3.select(this.parentNode).datum();
              return rowNum == d.classed && d.classed != 0;
            }).append('rect')
              .attr('width',rSize*1.35)//rSize*1.5) //unitWidth/2
              .attr('height',rSize*1.35)//rSize*1.5) //unitWidth/2
              .attr('x',-rSize/2)
              .attr('y',-rSize/2)
              .attr('opacity',function(d){
                // if(data.show){
                //   if(d.highlight == 1){
                //     return fullOpacity;
                //   } else {
                //     return minOpacity;
                //   }
                // } else {
                  return maxOpacity;
                // }
              })
              .attr('class',function(d){
                if(data.show){
                  if(typeof d[data.container] != 'undefined' && d[data.container] != ''){
                    return 'viz-unit active';
                  } else {
                    if(d.classed == 0){
                      return 'viz-unit subtle';
                    } else {
                      return 'viz-unit subtle active';
                    }
                  }
                } else {
                  return 'viz-unit';
                }
              })
              .attr('data-classed',function(d){
                var rowNum = d3.select(this.parentNode.parentNode).datum();
                if(rowNum == d.classed){
                  return d.classed;
                } else {
                  return 0;
                }
              })
              .attr('transform',function(d){
                var rowNum = d3.select(this.parentNode.parentNode).datum();
                if(d.classed == rowNum && data.show){
                  // If set to "show," simply show it
                  return 'scale(1) rotate(' + rotate + ')';
                } else {
                  if(d.classed == rowNum){
                    // If a real circle, show it
                    return 'scale(1) rotate(' + rotate + ')';
                  } else {
                    // If not a real circle, don't show it
                    return 'scale(0) rotate(0)';
                  }
                }
              });
        // Circle view
              // note.append('circle')
              //   .attr('r',rSize) //unitWidth/2
              //   .attr('cx',0)
              //   .attr('cy',0)
              //   .attr('opacity',function(d){
              //     // if(data.show){
              //     //   if(d.highlight == 1){
              //     //     return fullOpacity;
              //     //   } else {
              //     //     return minOpacity;
              //     //   }
              //     // } else {
              //       return maxOpacity;
              //     // }
              //   })
              //   .attr('class',function(d){
              //     if(data.show){
              //       if(d[data.container] == 1){
              //         return 'viz-unit';
              //       } else {
              //         return 'viz-unit subtle';
              //       }
              //     } else {
              //       return 'viz-unit';
              //     }
              //   })
              //   .attr('data-classed',function(d){
              //     var rowNum = d3.select(this.parentNode.parentNode).datum();
              //     if(rowNum == d.classed){
              //       return 0; //d.classed;
              //     } else {
              //       return 0;
              //     }
              //   })
              //   .attr('transform',function(d){
              //     var rowNum = d3.select(this.parentNode.parentNode).datum();
              //     if(d.classed == rowNum && data.show){
              //       // If set to "show," simply show it
              //       return 'scale(1)';
              //     } else {
              //       if(d.classed == rowNum){
              //         // If a real circle, show it
              //         return 'scale(1)';
              //       } else {
              //         // If not a real circle, don't show it
              //         return 'scale(0)';
              //       }
              //     }
              //   });
        // Append annotations where applicable
        if(typeof settings[data.file] !== 'undefined' && typeof settings[data.file].annotations !== 'undefined' && typeof settings[data.file].annotations[data.container] !== 'undefined'){
          $.each(settings[data.file].annotations[data.container],function(i,match){
            var annotation = note.filter(function(d){
              // Get only notes where we're showing the color
              var rowNum = d3.select(this.parentNode).datum();
              return rowNum == d.classed && match.timecode == d.timecode? this : null;
            })
              .append('g')
                .attr('class','annotation')
                .attr('transform',function(){
                  return data.show ? 'scale(1)' : 'scale(0)';
                });

            $.each(match.text.split('<br />'),function(j,text){
              annotation.append('text')
                .text(function(d){
                  return text;
                })
                .attr('text-anchor',function(d){
                  return match.anchor;
                })
                .attr('y',function(d){
                  var lineSpacing = 14;
                  if(match.position == 'under'){
                    return rSize*1.75+(lineSpacing*j);
                  } else if (match.position == 'above'){
                    return -rSize*2+(lineSpacing*j);
                  }
                });
            });
          });
        }

        //  Trigger resize function now that we're done
        $(window).resize(resize);
     },
     createLyrics: function(data){
       // Overall variables for audio/lyric functions
       var listenerInterval = null;
       var red ='#B83339';
       var blue = '#60C4F2';
       var pink = '#E089B7';
       var green = '#39793A';
       // Create array with all timecodes for easy searching
       var timecodes = [];
       var timecodeCompleted = [];

       $.each(data.lyrics,function(i,d){
         timecodes.push(d.timecode);
       });
       // Parse the index timestamp as a number
       // When not stored as "t##" the array goes out of order
       function getIndex(i){
         return parseFloat(i.replace(/t/g,''));
       }
       // Get all matching words to show based on timestamp
       // This returns all words BEFORE the current timestamp
       // Because there is no way to know what timestamp we're getting
       // So it can jump ahead unexpectedly
       function getMatches(t){
          var matches = [];
          $.each(timecodes,function(i,timecode){
            // console.log(timecode,t);
            if(timecode < t && jQuery.inArray(timecode,timecodeCompleted) == -1){
              k = data.lyrics[i];
              k['index'] = i;
              matches.push(k);
            }
          });
          // console.log(matches);
          // if(matches.length == 0){
          //   return matches;
          // } else {
          //   return matches[matches.length-1];
          // }
          return matches;
       }


       d3.selection.prototype.last = function() {
         var last = this.size() - 1 < 0 ? 0 : this.size() - 1;
         return d3.select(this[0][last]);
       };

       var rotate = -45;

       function animateIn(timecode){
        //  console.log(timecode);
         // Loop through array to highlight text/viz based on index
         var rows = d3.selectAll('#viz-'+data.container+' .viz-row');

        //  $.each(lyricsArr,function(i,lyrics){
        //    console.log(lyrics);
        //  });

                // var rowMatch = rows.filter(function(d){
                //   return d === lyrics.classed;
                // });

                // Shape animations
                var matchingNotes = rows.selectAll('.note')
                  .filter(function(d,i){
                    var rowNum = d3.select(this.parentNode).datum();
                    // if(rowNum == d.classed && d.classed != 0 && d.timecode <= timecode){
                    //   console.log(d.show,d.timecode,timecode);
                    // }
                    return rowNum == d.classed && d.classed != 0 && d.timecode <= timecode && !d.show ? this : null;
                  });
                // First row notes (for word-sounds)
                var firstRowMatchingNotes = rows.selectAll('.note')
                  .filter(function(d,i){
                    var rowNum = d3.select(this.parentNode).datum();
                    return rowNum == 0 && d.timecode <= timecode ? this : null;
                  });

                // First row notes (for word-sounds)
                var proceedingNotes = rows.selectAll('.note')
                  .filter(function(d,i){
                    var rowNum = d3.select(this.parentNode).datum();
                    return rowNum == 0 && d.timecode > timecode ? this : null;
                  });

                  // console.log(matchingNotes.size());

              //           // Reset to zero
                    matchingNotes.selectAll('rect')
                      .attr('transform','scale(' + 0.3 + ') rotate(' + rotate + ')')
                        // .attr('data-classed',function(d){
                        //   var rowNum = d3.select(this.parentNode.parentNode).datum();
                        //   if(rowNum == d.classed){
                        //     return d.classed;
                        //   } else {
                        //     return 0;
                        //   }
                        // })
                      .transition().duration(data.speed).ease(data.easing)
                        .attr('transform','scale(1) rotate(' + rotate + ')')
                        .attr('class',function(d,i){
                          d.show = true;
                          // timecodeCompleted.push(lyrics.timecode);
                          return d3.select(this).attr('class') + ' active animated';
                        });

                    // Last match
                    // console.log(firstRowMatchingNotes.size());
                    // var lastMatch = firstRowMatchingNotes.filter(function(d,i){
                    //   return i == firstRowMatchingNotes.size()-1 ? this : null;
                    // });
                    // console.log(lastMatch);

                        // Hide all following notes (in cases where we've clicked em)
                        proceedingNotes
                          .selectAll('.word-sound').select('text')
                          .attr('transform',function(d,i){
                            return 'scale(' + data.startSize + ')';
                          })
                          .attr('opacity',function(d){
                            return 0;
                          });

                        // Show only most timely note
                        firstRowMatchingNotes.last()
                          .selectAll('.word-sound').select('text')
                            .transition().duration(data.speed).ease(data.easing)
                          .attr('transform',function(d,i){
                            return 'scale(1)';
                          })
                          .attr('opacity',function(d){
                            return 1;
                          });

                        // HIde all preceeding notes that aren't the current most timely note
                        firstRowMatchingNotes.filter(function(d,i){
                          return firstRowMatchingNotes.last()[0][0] != 'undefined' && d != firstRowMatchingNotes.last().datum();
                        })
                          .selectAll('.word-sound').select('text')
                            .transition().duration(data.speed).ease(data.easing)
                          .attr('transform',function(d,i){
                            return 'scale(' + data.startSize + ')';
                          })
                          .attr('opacity',function(d){
                            return 0;
                          });


                          // Hide other word sounds with some immediacy
                            // firstRowMatchingNotes.filter(function(d,i){
                            //   return i == firstRowMatchingNotes.size()-1 ? this : null;
                            // })
                            //   .selectAll('.word-sound').select('text')
                            //   .text('-')
                            //     .transition().duration(data.speed).ease(data.easing);
                            // .attr('transform',function(d){
                            //   return 'scale(' + data.startSize + ')';
                            // })
                            // .attr('opacity',function(d){
                            //   return '0';
                            // });

                          // .attr('class','word-sound active')
                          // .each("end",function(){
                          //   d3.select(this)
                          //     .attr('class',function(d){
                          //       d.started = false;
                          //       return 'word-sound';
                          //     });
                          // });
                      // } else {
                      //   rows
                      //     .selectAll('.word-sound').select('text')
                      //         .filter(function(d){
                      //           return d.timecode != lyrics.timecode;
                      //         })
                      //     .attr('transform',function(d){
                      //       return d.timecode != lyrics.timecode ? 'scale(1)' : 'scale(' + data.startSize + ')';
                      //     })
                      //     .attr('opacity',function(d){
                      //       return d.timecode != lyrics.timecode ? 1 : 0;
                      //     });
                      // }
                      // Show matching line break
                      rows
                        .selectAll('.break').filter(function(d){
                          return d.timecode <= timecode;
                        })
                          .transition().delay(100).duration(data.speed)
                          .attr('opacity',function(d){
                            return 1;
                          });
              //
              //         // Actions for when we've reached the last word
              //         // console.log(lyrics.index, data.lyrics.length)
              //
                  if(firstRowMatchingNotes.last().size() > 0 && firstRowMatchingNotes.last()[0][0] != 'undefined'  && firstRowMatchingNotes.last().datum().timecode == data.lyrics[data.lyrics.length-1].timecode){
                        // Bring in lyrics
                        if(!$('#lyrics-'+data.container).hasClass('active')){
                          // Show lyrics
                          $('#lyrics-'+data.container + ' .lyrics')
                            // .animate({
                            //   opacity:1
                            // })
                            .addClass('active');
                          // Colorize lyrics on slight delay
                          setTimeout(function(){
                            $('#lyrics-'+data.container + ' .lyrics span').addClass('active');
                            $('#tunes-'+data.container+' .lyrics-container').addClass('active').fadeIn();
                            // Highlight just the ones to Highlight
                            // These needs to animate instead of setting a class
                            // And also needs annotations or markers to make it extra clear
                            // var notes = rows
                            //   .selectAll('.viz-unit');
                            // notes
                            //   .attr('class',function(d){
                            //     console.log(d[data.container]);
                            //     if(typeof d[data.container] !== 'undefined'){
                            //       // There is a highlight field, so let's show it
                            //       var subtle = d[data.container] == 1 ? '' : 'subtle';
                            //       return 'viz-unit active ' + subtle;
                            //     } else {
                            //       return d3.select(this).attr('class');
                            //     }
                            //   });
                            // Hide any remaining word-sounds text
                            rows
                              .selectAll('.word-sound').select('text')
                                .transition().delay(600).duration(data.speed).ease(data.easing)
                              .attr('transform',function(d){
                                return 'scale(' + data.startSize + ')';
                              })
                              .attr('opacity',0);

                          },500);
                          // Show any annotations that exist
                          rows
                            .selectAll('.annotation')
                              .transition().delay(600).duration(data.speed).ease(data.easing)
                            .attr('transform','scale(1)');

                          // Ensure all lines are colored in
                          if(window.innerWidth > 620){
                            rows
                              .selectAll('.sound')
                                  .transition().delay(600).duration(data.speed).ease(data.easing)
                                .attr('opacity',1);
                          }
                        }
                      }

              //      Highlight matching lyric span in .lyrics div
              //      $('#lyrics-' + data.container + ' span[data-index="' + lyrics.index + '"]').addClass('active');
              //
              //      // Highlight viz block
              //      $sel = $('#viz-' + data.container + ' .viz-unit[data-index="' + lyric.index + '"]');
              //      $sel.not('active').addClass('active').css({
              //        top:0
              //      });
              //      if(lyric.linebreak==1){
              //        $sel.next().addClass('active');
              //      }
              // });

       }

       // Start interval to check for lyrics
       function startUpdate(){
         var timecodeCompleted = [];
         listenerInterval = setInterval(function(){
           // TODO: Account for flash fallback
               var timestamp = $('#audio-player-' + data.container + ' .jp-jplayer').data('jPlayer').htmlElement.audio.currentTime;
               // Get all matching lyrics in an array
              //  var lyrics = getMatches(timestamp);
              //  if(lyrics != []){
              if(timestamp > 0){
               animateIn(timestamp);
              }
        },100);
       }


       // Stop checking for updates to the lyrics
       function stopUpdate(){
         clearInterval(listenerInterval);
         listenerInterval = null;
       }

       // Hide and show relevant play/pause buttons
       function handleButtons(state,delay){
         var $controls = $('#tunes-'+ data.container + ' .standalone-play-pause');
         setTimeout(function(){
           $controls.animate({
             'opacity':1
           });
           if(state=='playing'){
            //  $('#tunes-'+ data.container + ' .jp-pause').hide();
            //  $('#tunes-'+ data.container + ' .jp-play').hide();
             // Adjust viz play/pause vs. inline play/pause
             $controls.find('.jp-play').hide();
             $controls.find('.jp-pause').show();
           } else {
            //  $('#tunes-'+ data.container + ' .jp-pause').hide();
            //  $('#tunes-'+ data.container + ' .jp-play').hide();
             // Adjust viz play/pause vs. inline play/pause
             $controls.find('.jp-play').show();
             $controls.find('.jp-pause').hide();
             // Ensure update is stopped
             stopUpdate();
           }
         },delay);
        //  if(!$('#tunes-'+data.container+' .lyrics-container').hasClass('active')){
        //    $('#tunes-'+data.container+' .lyrics-container').fadeOut();
        //  }
        //  .animate({
        //    marginTop:0
        //  });
         $('#tunes-'+ data.container + ' .audio-player').fadeOut();
       }


       // Clear all visual classes on lyrics so we can repeat
       function reset(){
         $('#lyrics-'+data.container + ' span').removeClass('active');
         $('#viz-'+data.container + ' .viz-unit').removeClass('active');
         d3.selectAll('#viz-'+data.container+' .viz-unit')
          .attr('transform','scale(0)');
       }

       // Pause the song on different events
       function pause(){
        //  console.log('pausing..');
         stopUpdate();
         handleButtons('pausing');
       }

       // Actually init each audio player using jPlayer plugin
       $('#audio-player-' + data.container + ' .jp-jplayer').jPlayer({
         ready: function () {
           $(this).jPlayer('setMedia', {
             title: data.file,
             mp3: 'audio/' + data.file + '.mp3',
             oga: 'audio/' + data.file + '.oggvorbis.ogg'
           });
         },
         timeupdate: function(event){
           // Get timestamp in milliseconds
           var timestamp = event.jPlayer.status.currentTime;
           //  console.log(timestamp);
           // This event triggers on load, so ensure we're not at zero before proceeding
           if(timestamp != 0){
           }
         },
         play: function() {
          //  console.log('Trigger Play');
          //  reset();
           // Stop all players
           $('.jp-jplayer').not(this).jPlayer("stop");
           // Clear interval if one is already started
           stopUpdate();
           // When pressing play, stop all other players
           handleButtons('playing',1500);
           startUpdate();
         },
        //  loadeddata: function(event){ // calls after setting the song duration
        //       songDuration = event.jPlayer.status.duration;
              // console.log(data.file,'"duration":' + songDuration+',');
        //   },
         pause: function(){
          //  console.log('pause..');
           pause();
         },
         cssSelectorAncestor: '#jp-container-' + data.container,
         swfPath: '/js',
         supplied: 'mp3, oga'
       });

       /* - Additional player controls - */
       if(data.music){
         $('#tunes-' + data.container + ' .standalone-play-pause .jp-play,#tunes-' + data.container + ' .standalone-play-pause .jp-pause').on('click',function(){
           var $player = $('#audio-player-' + data.container + ' .jp-jplayer');
           if($(this).hasClass('jp-play')){
             $player.jPlayer('play');
             handleButtons('playing');
           } else {
             $player.jPlayer('pause');
             handleButtons('pausing');
           }
         });
       }

       /* - Show lyircs on click - */
       $('#tunes-'+data.container+' .view-lyrics').click(function(){
         $('#tunes-'+data.container+' .lyrics').toggleClass('show');
         $('#tunes-'+data.container).toggleClass('lyrics-showing');
       });

       /* - Swiper Functions for controlling the playhead -*/
      //  window.swiperV.onSlideChangeStart(function(){
      //    $('.jp-jplayer').jPlayer('stop');
      //  });

     },
     resize: function(){

     }
   }
   return app.init();
}
