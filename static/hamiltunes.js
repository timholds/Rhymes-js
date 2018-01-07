(function(){
    // **General arpabet dictionaries and stop words**
    stopWords = ["the","a","i","an","or","to"];
    function stopWord(g){
        return _.contains(stopWords,g.parent.word) ? true : false;
    }
    boringWords = ["the","be","to","of","and","a","in","that","have","I","it","for","not","on","with","he","as","you","do","at","this","but","his","by","from","they","we","say","her","she","or","an","will","my","one","all","world","there","their","what","so","who","if","them","yeah"];

    vowel_sounds = ["AO","AA", "IY", "UW", "EH", "IH", "UH", "AH", "AE", "EY", "AY", "OW", "AW", "OY", "ER"];

    generic_vowels = {
        "IY": "IY",
        "UW": "UW",
        "AO": "AA",
        "AA": "AA",
        "EH": "EH",
        "AE": "AE",
        "IH": "EH",
        "UH": "EH",
        "AH": "EH",
        "EY": "EY",
        "AY": "AY",
        "OW": "OW",
        "AW": "AW",
        "OY": "OY",
        "ER": "ER"
    };

    // **genericVowelEq**
    //
    // The main function to score compatible, non-identical vowels with each other
    function genericVowelEq(va,vb){
        // The vowel groupings correspond to similar formant frequencies and tongue locations
        var fschwas = ["EH","IH"],
            both_fschwa = _.contains(fschwas,va) && _.contains(fschwas,vb),
            bschwas = ["UH","AH"],
            both_bschwa = _.contains(bschwas,va) && _.contains(bschwas,vb),
            backo = ["AA","AO","AH"],
            both_backo = _.contains(backo,va) && _.contains(backo,vb),
            backo2 = ["AA","AE"],
            both_backo2 = _.contains(backo2,va) && _.contains(backo2,vb),
            fronto = ["EH","AH"],
            both_fronto = _.contains(fronto,va) && _.contains(fronto,vb),
            fronto2 = ["EH","AE"],
            both_fronto2 = _.contains(fronto2,va) && _.contains(fronto2,vb),
            backo_dip = ["AO","OW"],
            both_backo_dip = _.contains(backo_dip,va) && _.contains(backo_dip,vb),
            // The "bad" vowels are those that are further apart but often used in rhymes
            bad_schwas = ["IH","AH"],
            both_bad = _.contains(bad_schwas,va) && _.contains(bad_schwas,vb),
            bad_eh = ["EH","EY"],
            both_bad2 = _.contains(bad_eh,va) && _.contains(bad_eh,vb) && false;


        if (both_fschwa || both_bschwa || both_backo || both_backo2 || both_fronto || both_fronto2 || both_backo_dip){
            // "Good" vowel families are scored higher than bad ones,
            // which is ultimately used to filter out weak rhymes
            return 1;
        } else if (both_bad || both_bad2){
            return 0.9;
        } else {
            // If the two different vowels don't fit into any family, return 0, 
            // effectively eliminating any chance of rhyme
            return false;
        }
    }

    
    // Destress is used to remove stress anotations for simple vowel comparison.
    function destress(str){
        return _.filter(str,function(s){return /[a-z]/i.test(s);}).join("");
    }

    // ## Syl
    // Syls are the main elements used to structure our rhyme comparison.
    // Syls map to syllables and are compared to other syllables to establish rhyme.
    function Syl(sounds,index,pro_index){
        this.sounds = sounds;
        this.raw_sounds = _.map(sounds,function(s){
            return destress(s);
        });
        
        // We break the syllable into a vowel, a prefix, and a suffix.
        this.vowel = _.find(sounds,function(s){
            return _.contains(vowel_sounds,destress(s));
        });

        this.vowel_index = sounds.indexOf(this.vowel);
        this.suffix = sounds.slice(this.vowel_index + 1);
        this.prefix = this.sounds.slice(0,this.vowel_index);

        // Syllable index and pronunciation index are use for contextual comparisons with
        // other syllables based on position
        this.index = index;
        this.pro_index = pro_index;

        // Total mark will record how strongly the syllable rhymes with all other syllables
        // in the verse
        this.total_mark = 0;

        // Color is used to group syllables into rhyme families
        this.color = 0;

        // Stress is used to score the quality of rhymes. Two stressed syllables rhyme more
        // strongly than one stressed and one unstressed. One stressed and one unstressed 
        // syllable rhyme more strongly than two unstressed syllables.
        if(! this.vowel){
            this.stressed = false;
        } else {
            this.stressed = this.vowel.indexOf("1") > 0 || this.vowel.indexOf("2") > 0;
        }

        // Head and tail neighbors are used to form rhyme patterns and strengthen or weaken
        // rhyme scores based on nearness to other rhyming syllables
        this.head_neighbors = [];
        this.tail_neighbors = [];

        // End word determines if the syllable is part of the last word on a line.
        // This is used to identify end rhymes.
        this.end_word = false;

    }

    // The label function is used to generate unique ids for each syllable, which 
    // will be used for node names in the eventual syllable graph
    Syl.prototype.label = function(){
        return this.parent.index + "-" + this.index + "-" + this.pro_index;
    };

    // The sameAs function is used to evaluate similar syllables across pronunciations
    Syl.prototype.sameAs = function(s){
        return this.index == s.index &&
               this.parent.index == s.parent.index;
    };

    // ## Phoword
    // Syllables are collected into pronuncation arrays, collected into Phowords. This 
    // allows us to eventually map the syllables back onto the original words.
    function Phoword(word,pros,index){
        this.word = word;
        this.pros = pros;
        this.index = index;
        this.sentence = -1;
        this.final_syls = [];

        var w = this;

        // For the last Phoword of each line, mark each of their syllables as belonging
        // to an end word.
        _.each(pros,function(p){
            var last_syl = p.length - 1;
            _.each(p,function(syl,i){
                syl.parent = w;
                if(i == last_syl){
                    syl.end_syl = true;
                } else {
                    syl.end_syl = false;
                }
            });
        });
    }

    // **replacePros**
    //
    // Used to manually adjust certain pronuncations 
    function replacePros(word,new_sounds,last_syl){
        _.each(word.pros,function(p,pi){
            var newsyl = new Syl(new_sounds,last_syl.index,pi);
            newsyl.parent = last_syl.parent;
            p.pop();
            p.push(newsyl);
        });
        return word;
    }

    // **lookup**
    //
    // Used to translate a raw english word into a series of syllablized, arpabet
    // pronunciations
    function lookup(w,sentence,index){
        var pros, sylpros, final_word, new_word, word, last_syl, new_sounds, newpro;

        // You can't look the word 'constructor' up in javascript. It is a reserved word.
        if (w === "constructor"){
            pros = [["K AH0 N","S T R AH1 K","T ER0"]];
        // First, check our hand-written dictionary
        } else if(ejdict[w]){
            pros = [ejdict[w]];
        // If the word matches a multiple pronunciation entry, grab both pronuncations
        } else if (syldict[w+"(2)"]){
            pros = [syldict[w],syldict[w+"(2)"]];
        // If the word matches a single pronunciation entry, grab it
        } else if (syldict[w]){
            pros = [syldict[w]];
        // If the word ends in 'ah', try the word as an 'er' word. This is used to 
        // handle alternative pronunciation of words common in rap lyrics
        } else if (w.match(/\w+?ah$/i)){
            new_word =  w.match(/(\w+?)ah/)[1] + "er";
            word = lookup(new_word,sentence,index);

            if(word && word.pros[0]){
                last_syl = word.pros[0].slice(-1)[0];
                new_sounds = last_syl.sounds.slice(0,last_syl.vowel_index);
                new_sounds = new_sounds.concat(["AH0"]);

                replacePros(word,new_sounds,last_syl);
            }
            word.word = w;
            return word;
        // If the word ends in n', try the word as an "ng" word
        } else if (w.match(/\w+?n[\'|’]?$/)){
            new_word =  w.match(/\w+/)[0] + "g";
            word = lookup(new_word,sentence,index);

            if(word && word.pros[0]){
                last_syl = word.pros[0].slice(-1)[0];
                new_sounds = last_syl.sounds;
                new_sounds = new_sounds.slice(0,-1).concat(["N"]);

                replacePros(word,new_sounds,last_syl);
            }
            word.word = w;
            return word;
        // If the word ends in s', try the word without the final apostrophe
        } else if (w.match(/\w+?s[\'|’]$/)){
            new_word = w.match(/\w+/)[0];
            word = lookup(new_word,sentence,index);

            if(word && word.pros[0]){
                last_syl = word.pros[0].slice(-1)[0];
                new_sounds = last_syl.sounds;

                replacePros(word,new_sounds,last_syl);
            }
            word.word = w;
            return word;
        // If the word is an 's possessive, try to lookup the word without the s and then add
        // the sound back on
        } else if (w.match(/\w+\'s/)){
            new_word = w.match(/\w+/)[0];
            word = lookup(new_word,sentence,index);

            if(word && word.pros[0]){
                last_syl = word.pros[0].slice(-1)[0];
                new_sounds = last_syl.sounds;
                new_sounds = new_sounds.concat(["S"]);

                replacePros(word,new_sounds,last_syl);
            }
            word.word = w;
            return word;
        // If the word is a plural, try the word without the s and then add the sound
        // back on 
        } else if (w.match(/'\w+?s/)){
            new_word = w.replace(/s$/,"");
            word = lookup(new_word,sentence,index);

            if(word && word.pros[0]){
                last_syl = word.pros[0].slice(-1);
                new_sounds = last_syl.sounds;
                new_sounds = new_sounds.slice(0,-1).concat(["S"]);

                replacePros(word,new_sounds,last_syl);
            }
            word.word = w;
            return word;
        // Otherwise, we cannot lookup the word
        } else {
            pros = [];
            console.log("Could not lookup",w);
        }

        // Often "-shan" words such as "Egyptian" are pronounced as "-shin" words,
        // so add that pronunciation
        var er_fudge = false;
        if (pros.length === 1 && pros[0].slice(-1) && pros[0].slice(-1)[0] === "SH AH0 N"){
            newpro = _.clone(pros[0]);
            last_syl = newpro.pop();
            last_syl = "SH IH0 N";
            newpro.push(last_syl);
            pros.push(newpro);
        }

        // Often "-er" words such as "monster are pronounced as "-ah" words ("monstah"),
        // so add that pronunciation
        if (pros.length > 0 && pros[0].slice(-1) && pros[0].slice(-1)[0].match(/ER\d$/)){
            newpro = _.clone(pros[0]);
            last_syl = newpro.pop();
            last_syl = last_syl.replace(/(.*?)ER(\d)$/,"$1AH$2");
            newpro.push(last_syl);
            pros.push(newpro);
            er_fudge = true;
        }

        // Often "-ers" words such as "monster are pronounced as "-ahs" words ("monstahs"),
        // so add that pronunciation
        if (pros.length > 0 && pros[0].slice(-1) && pros[0].slice(-1)[0].match(/ER\d Z$/)){
            newpro = _.clone(pros[0]);
            last_syl = newpro.pop();
            last_syl = last_syl.replace(/(.*?)ER(\d) Z$/,"$1AH$2 Z");
            newpro.push(last_syl);
            pros.push(newpro);
            er_fudge = true;
        }

        // Map every pronunciation on to an array of Syls
        sylpros = _.map(pros, function(p,pi){
            return _.map(p, function(syl,syli){
                if(!syl){
                    console.log(w);
                }
                return new Syl(syl.split(" "),syli,pi);
            });
        });

        // If we added an "-er" to "-ah" pronunciation, mark the syllable. We will
        // use this information to make rhymes against this pronunciation stricter
        if(er_fudge){
            if(sylpros.slice(-1)[0] && sylpros.slice(-1)[0].slice(-1)[0]){
                sylpros.slice(-1)[0].slice(-1)[0].er_fudge = true;
            }
        }

        final_word = new Phoword(w,sylpros,index);
        final_word.sentence = sentence;
        return final_word;
    }

    // **cleanSentence**
    //
    // Remove all smart apostrophes and single quotes
    function cleanSentence(sentence){
        return _.map(sentence,function(word){
            return word.replace(/’|‘/g,"'");
        });
    }

    // **processText**
    //
    // Transform an array of string arrays (a series of sentences) into
    // an array of Phoword arrays
    function processText(text){
        var lines, filtered, numbered, index, sounds, all_words, all_syls;

        // Tokenize each line into words, separating out all non-apostrophe punctuation
        lines = _.map(text,function(line){
            return line.match(/[\w\'’]+|[^\w\s\'’]+/g);
        });

        // Remove all smart single-quotes
        lines = _.map(lines,function(s){
            return cleanSentence(s);
        });

        // Remove all non-apostrophe punctuation and other non-word noise
        filtered = _.map(lines,function(sentence){
            var words = _.filter(sentence,function(w){
                return w.match(/[\w\']{2,}|\w+/);
            });
            return _.map(words,function(w){return w.toLowerCase();});
        });

        numbered = [];
        index = 0;

        // Number each sentence and word
        _.each(filtered,function(sentence){
            var s = [];
            _.each(sentence,function(word){
                s.push([word,index]);
                index++;
            });
            numbered.push(s);
        });

        // Lookup each word and transform it into a Phoword
        sounds = _.map(numbered, function(sentence,sentence_index){
            return _.map(sentence, function(s){
                var w = s[0],
                    w_index = s[1];
                return lookup(w,sentence_index,w_index);
            });
        });

        // Flatten the sentences into an array of words
        all_words = _.flatten(sounds,true);

        // Filter out any falsy values (nulls, undefineds, etc)
        all_words = _.filter(all_words,function(w){return w;});

        all_syls = [];

        // Create a flat list of syllables
        _.each(all_words,function(word){
            _.each(word.pros,function(p){
                _.each(p,function(syl){
                    all_syls.push(p);
                });
            });
        });

        return [sounds,all_syls,all_words];
    }

    // Safely return the first n characters of a string
    function firstN(l,n){
        if (n >= 0){
            return l.slice(0,n);
        } else {
            return [];
        }
    }

    // Safely return the last n characters of a string
    function lastN(l,n){
        if (n > 0){
            return l.slice(-1 * n);
        } else {
            return [];
        }
    }

    // **findNeighborN**
    //
    // Locate the n syllables that occur before a given syllable and the n syllables occuring
    // after. This is used for sequential rhyme pattern identification
    function findNeighborN(syl, i, words){
        var sister_syls, sister_words, sister_word_counts, sister_word_counts_t, total, remainder,
            head_index;
        if(i > 0){
            sister_syls = syl.parent.pros[syl.pro_index].slice(syl.index+1,syl.index+1+i);
            sister_words = words.slice(syl.parent.index+1,syl.parent.index+1+i);
            sister_word_counts = _.map(sister_words, function(w){
                var smallest_pro = _.min(w.pros, function(x){return x.length;});
                return [w,smallest_pro.length];
            });
            sister_word_counts_t = [];
            total = 0;
            remainder = i - sister_syls.length;

            _.each(sister_word_counts,function(wc){
                var w = wc[0],
                    c = wc[1];
                sister_word_counts_t.push([w,total]);
                total += c;
            });

            sister_word_syls = _.map(sister_word_counts_t,function(wc){
                var w = wc[0],
                    c = wc[1];
                return _.map(w.pros,function(p){
                    return firstN(p,remainder - c);
                });
            });
            sister_word_syls = _.flatten(sister_word_syls);
            return sister_syls.concat(sister_word_syls);
        } else if (i < 0){
            if(syl.index + i >= 0){
                sister_syls = syl.parent.pros[syl.pro_index].slice(syl.index + i,syl.index);
            } else {
                sister_syls = syl.parent.pros[syl.pro_index].slice(0,syl.index);
            }

            head_index = syl.parent.index+i >= 0 ? syl.parent.index+i : 0;
            sister_words = words.slice(head_index,syl.parent.index);
            sister_word_counts = _.map(sister_words,function(w){
                var smallest_pro = _.min(w.pros, function(x){return x.length;});
                return [w, smallest_pro.length];
            });
            sister_word_counts_t = [];
            total = 0;
            remainder = (-1 * i) - sister_syls.length;

            _.each(_.clone(sister_word_counts).reverse(),function(wc){
                var w = wc[0],
                    c = wc[1];
                sister_word_counts_t = [[w,total]].concat(sister_word_counts_t);
                total += c;
            });

            sister_word_syls = _.map(sister_word_counts_t,function(wc){
                var w = wc[0],
                    c = wc[1];
                return _.map(w.pros,function(p){
                    return lastN(p, remainder - c);
                });
            });
            sister_word_syls = _.flatten(sister_word_syls);
            return sister_word_syls.concat(sister_syls);
        }
    }

    // **findNeighbors**
    //
    // Assign every syllables its:
    // - Tail neighbors, the two syllables occuring directly after the syllable
    // - Head neighbors, the two syllables occuring directly before the syllable
    // - Next neighbors, the syllable occuring directly after the syllable
    // - Prev neighbors, the syllable occuring directly before the syllable
    function findNeighbors(words){
        var total_words = words.length,
            last_sentence = 0;

        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(syl){
                    syl.tail_neighbors = findNeighborN(syl,2,words);
                    syl.head_neighbors = findNeighborN(syl,-2,words);
                    syl.next_neighbors = findNeighborN(syl,1,words);
                    syl.prev_neighbors = findNeighborN(syl,-1,words);
                    if (syl.parent.sentence != last_sentence){
                        _.each(words[syl.parent.index - 1].pros, function(pro){
                            _.each(pro,function(s){
                                s.end_word = true;
                            });
                        });
                        last_sentence = syl.parent.sentence;
                    }

                    if (syl.parent.index == words.length - 2){
                        _.each(syl.parent.pros,function(pro){
                            _.each(pro,function(s){
                                s.end_word = true;
                            });
                        });
                    }
                });
            });
        });
    }

    // **isDiff**
    //
    // Return whether or not two syllables are indeed different, even across pronunciations
    function isDiff(syla,sylb){
        return syla.label() != sylb.label() && ! (syla.parent.index === sylb.parent.index && syla.pro_index !== sylb.pro_index);
    }

    // **isClose**
    //
    // Return whether or not two syllables are near enough each other to consider a rhyme
    function isClose(sa,sb,is_in_pattern){
        if(typeof(is_in_pattern) === "undefined"){
            is_in_pattern = false;
        }

        return Math.abs(sa.parent.sentence - sb.parent.sentence) < 2 ||
               (sa.end_word && sb.end_word) ||
               (Math.abs(sa.parent.sentence - sb.parent.sentence) < 3 && is_in_pattern);
    }

    // **isJunk**
    //
    // Return whether two words are both boring, to eliminate rhymes between high frequency words
    function isJunk(sa,sb){
        var both_boring = _.contains(boringWords,sa.parent.word) && _.contains(boringWords,sb.parent.word);
        return both_boring;
    }

    // **isRep**
    //
    // Determine if two syllables should be considered a repetition rather than a rhyme
    function isRep(sa,sb){
        var sameSounds = _.isEqual(sa.raw_sounds, sb.raw_sounds),
            sameSoundSyla = _.some(sa.tail_neighbors, function(t){
                if(_.isEmpty(t.prefix)){
                    return false;
                } else {
                    return _.isEqual(sb.raw_sounds,sa.raw_sounds.concat([t.prefix[0]]));
                }
            }),
            sameSoundSylb = _.some(sb.tail_neighbors, function(t){
                if(_.isEmpty(t.prefix)){
                    return false;
                } else {
                    return _.isEqual(sa.raw_sounds,sb.raw_sounds.concat([t.prefix[0]]));
                }
            }),
            isPlural = _.isEqual(sa.raw_sounds.concat(["Z"]), sb.raw_sounds) || _.isEqual(sa.raw_sounds, sb.raw_sounds.concat(["Z"])),
            isPlurals = _.isEqual(sa.raw_sounds.concat(["S"]), sb.raw_sounds) || _.isEqual(sa.raw_sounds, sb.raw_sounds.concat(["S"]));

        return (sameSoundSyla || sameSoundSylb || sameSounds || isPlural || isPlurals) && (! sa.sameAs(sb)) && isClose(sa,sb);
    }

    // **vowelScore**
    //
    // Score the similarity between two syllables' vowels. This is one of the three components
    // of a syllable pair's overall rhyme score
    function vowelScore(sa,sb){
        var deva = destress(sa.vowel),
            devb = destress(sb.vowel),
            same_vowel = deva == devb,
            near_vowel = genericVowelEq(deva,devb),
            de_ra = deva == "ER" && _.contains(["AH","EH"],devb),
            de_rb = devb == "ER" && _.contains(["AH","EH"],deva),
            tail_sibling_a,tail_sibling_b,sound_a,sound_b;

        if (sa.tail_neighbors.length > 0 && sb.tail_neighbors.length > 0){
            tail_sibling_a = sa.tail_neighbors[0];
            tail_sibling_b = sb.tail_neighbors[0];
            if(tail_sibling_a.parent.index === sa.parent.index){
                sound_a = tail_sibling_a.prefix.slice(0,1);
            }
            if(tail_sibling_b.parent.index === sb.parent.index){
                sound_b = tail_sibling_b.prefix.slice(0,1);
            }
        }

        if (same_vowel){
            return 1;
        } else if (de_ra || de_rb){
            return 0.6;
        } else if (near_vowel){
            return 0.5*near_vowel;
        } else {
            return 0;
        }
    }

    // **suffixScore**
    //
    // Compare the two suffixes of two syllables to determine whether or not they rhyme
    // and to what extent they do so (how similar are their suffixes)
    function suffixScore(sa,sb,vs,strict){
        if(typeof(strict) === "undefined"){
            strict = false;
        }
        var deva = destress(sa.vowel),
            devb = destress(sb.vowel),
            same_last = _.isEqual(sa.suffix, sb.suffix),
            both_er = deva == "ER" && devb == "ER" && sa.suffix.length === 0 && sb.suffix.length === 0,
            suffa = sa.suffix,
            suffb = sb.suffix,
            same_vowel = vs === 1,
            both_end = sa.end_syl && sb.end_syl,
            both_good = ! _.contains(boringWords,sa.parent.word) && ! _.contains(boringWords,sb.parent.word),
            tail_sibling_a, tail_sibling_b,
            sound_a, sound_a_loose,
            sound_b, sound_b_loose,
            de_ra, de_ra_loose, de_ra_plus, de_ra_collapse,
            de_rb, de_rb_loose, de_rb_plus, de_rb_collapse;

         if (sa.tail_neighbors.length > 0 && sb.tail_neighbors.length > 0){
            tail_sibling_a = sa.tail_neighbors[0];
            tail_sibling_b = sb.tail_neighbors[0];
            if(tail_sibling_a.parent.index === sa.parent.index){
                sound_a = tail_sibling_a.prefix.slice(0,1);
            }
            if(tail_sibling_b.parent.index === sb.parent.index){
                sound_b = tail_sibling_b.prefix.slice(0,1);
            }
        }

        if (deva == "ER"){
            suffa = ["R"].concat(suffa);
        }

        if (devb == "ER"){
            suffb = ["R"].concat(suffb);
        }

        // If nothing else, the score for a suffix pair is 0
        var candidates = [[0,true]];


        // If we are not asking for a strict suffix comparison, we simply ask for the score
        // of the two syllables' suffix. The strictness guard will eventually be used to test 
        // whether or not two, suffix-less syllables actually rhyme
        if (!strict){
            candidates.push(PH.suffCompare(suffa,suffb,sa.vowel,sb.vowel,both_end,both_good));
        }

        // If two syllables share a vowel and neither has a suffix and one of the words is mono-syllabic,
        // give the two syllables a high score
        if (deva === devb && suffa.length === 0 && suffb.length === 0 && sb.parent.pros[sb.pro_index].length === 1 && ! _.contains(boringWords,sb.parent.word)){
            candidates.push([0.75,true]);
        }

        if (deva === devb && suffa.length === 0 && suffb.length === 0 && sa.parent.pros[sa.pro_index].length === 1 && ! _.contains(boringWords,sa.parent.word)){
            candidates.push([0.75,true]);
        }

        // Next consider alternate suffixes created by appending prefix sounds from successive 
        // syllables.
        if (! _.contains(sound_a, "W") && ! _.contains(sound_a, "Y") && sound_a && sound_a.length > 0){
            candidates.push(PH.suffCompare(suffa.concat(sound_a),suffb,sa.vowel,sb.vowel,both_end,both_good));
        }
        if (! _.contains(sound_b, "W") && ! _.contains(sound_b, "Y") && sound_b && sound_b.length > 0){
            candidates.push(PH.suffCompare(suffa,suffb.concat(sound_b),sa.vowel,sb.vowel,both_end,both_good));
        }
        if (! _.contains(sound_a, "W") && ! _.contains(sound_a, "Y") && ! _.contains(sound_b, "W") && ! _.contains(sound_b, "Y") && sound_a && sound_b && sound_a.length > 0 && sound_b.length > 0){
            candidates.push(PH.suffCompare(suffa.concat(sound_a),suffb.concat(sound_b),sa.vowel,sb.vowel,both_end,both_good));
        }

        // Finally, score -er vs -ah suffixes as high
        if (deva == "ER" && devb == "AH" && sa.suffix.length === 0 && sb.suffix.length === 0){
            candidates.push([0.75,true]);
        }
        if (devb == "ER" && deva == "AH" && sa.suffix.length === 0 && sb.suffix.length === 0){
            candidates.push([0.75,true]);
        }
        if (strict){
            candidates = _.filter(candidates,function(c){return c[1];});
        }

        // Return the highest possible score of the above considered
        return [_.max(candidates,function(c){return c[0];}),candidates];
    }

    // **stressScore**
    //
    // Score the stress between two syllables
    function stressScore(sa,sb){
        if (sa.stressed && sb.stressed){
            return 0.75;
        } else if (sa.stressed || sb.stressed) {
            return 0.5;
        } else {
            return 0.25;
        }
    }

    // **rhymeScore**
    //
    // Combine the vowel_score, suffix_score, and stress_score to achieve
    // a composite measure of rhyme strength between two syllables
    function rhymeScore(syla,sylb){
        var vowel_score = vowelScore(syla,sylb),
            suffix_score = suffixScore(syla,sylb,vowel_score),
            stress_score = stressScore(syla,sylb),
            raw_score = vowel_score * suffix_score[0][0] * stress_score;

        return [Math.pow(raw_score, 1 + SCALE*0.8), suffix_score[1],vowel_score,stress_score, suffix_score[0][1]];
    }

    // **calculateRhymes**
    //
    // Evaluate the rhymes score between every pair of syllables and record them in a graph.
    // The rhymeScore is used to weight the edges between the syllable nodes
    function calculateRhymes(syla,words,G){
        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(sylb){
                    if (isDiff(syla,sylb) && ! stopWord(syla) && ! stopWord(sylb)){
                        var score_raw = rhymeScore(syla,sylb),
                            score = score_raw[0],
                            candidates = score_raw[1],
                            vs = score_raw[2],
                            stress = score_raw[3],
                            safe_match = score_raw[4],
                            a_short = syla.suffix.length === 0 && destress(syla.vowel) !== "ER",
                            b_short = sylb.suffix.length === 0 && destress(sylb.vowel) !== "ER",
                            split_suff = ((a_short || b_short) && ! isRep(syla,sylb)) && ! (syla.end_syl && sylb.end_syl),
                            has_rel = false;
                        // If the two Syls are considered a repetition, give them a medium score
                        // and mark them as such
                        if (isRep(syla,sylb)){
                            G.addEdge(syla.label(),sylb.label());
                            G.adj.get(syla.label()).get(sylb.label()).weight = 2;
                            G.adj.get(syla.label()).get(sylb.label()).rep = true;
                            G.adj.get(syla.label()).get(sylb.label()).vs = vs;
                            G.adj.get(syla.label()).get(sylb.label()).stress = stress;
                            G.adj.get(syla.label()).get(sylb.label()).safe = safe_match;
                            has_rel = true;

                        // If the two syllables rhyme off an er_fudge but they are an otherwise
                        // poor match, do not record the rhyme
                        } else if ((syla.er_fudge || sylb.er_fudge) && (!(syla.end_syl && sylb.end_syl) || (_.difference(syla.suffix,["Z"]).length > 0 || _.difference(sylb.suffix,["Z"]).length > 0))){
                            // dont let er_fudges mid rhyme

                        } else if (score > 0){
                            // Otherwise, record the score of all positive rhymes
                            G.addEdge(syla.label(),sylb.label());
                            G.adj.get(syla.label()).get(sylb.label()).weight = score * 4;
                            G.adj.get(syla.label()).get(sylb.label()).rep = false;
                            G.adj.get(syla.label()).get(sylb.label()).vs = vs;
                            G.adj.get(syla.label()).get(sylb.label()).stress = stress;
                            G.adj.get(syla.label()).get(sylb.label()).safe = safe_match;
                            has_rel = true;
                        }

                        // If the two syllables are related and they rhyme without suffixes,
                        // ie they are two mid word sounds, mark that and determine whether or not
                        // they would match if more successive sounds were considered
                        if(has_rel && split_suff){
                            G.adj.get(syla.label()).get(sylb.label()).split = true;
                            G.adj.get(syla.label()).get(sylb.label()).real_match = _.some(candidates.slice(1),function(c){
                                return c > 0.1;
                            }) || destress(syla.vowel) === destress(sylb.vowel);
                        }
                    }
                });
            });
        });
    }

    // **isRelated**
    //
    // Convenience function to to determine whether or not two syllables have
    // any rhyme relationship
    function isRelated(sa,sb,G){
        if (G.adj.get(sa.label()).get(sb.label())){
            return true;
        } else {
            return false;
        }
    }

    // **isInPattern**
    //
    // Return whether or not there are other syllables near a syllable pair that also rhyme
    // Used to build context for larger-scale rhyme analysis
    function isInPattern(syla,sylb,G){
        var shares_head_pattern = _.some(syla.head_neighbors,function(na){
                return _.some(sylb.head_neighbors,function(nb){
                    return isRelated(na,nb,G);
                });
            }),
            shares_tail_pattern = _.some(syla.tail_neighbors,function(na){
                return _.some(sylb.tail_neighbors,function(nb){
                    return isRelated(na,nb,G);
                });
            }),
            both_end = (syla.end_word && sylb.end_word && syla.index == sylb.index);
        return shares_head_pattern || shares_tail_pattern || both_end;
    }


    // **isInGroupPattern**
    //
    // Return whether or not there are other syllables near a syllable pair that are in the same
    // rhyme family
    // Used to build context for larger-scale rhyme analysis
    function isInGroupPattern(syla,sylb,strict,vs){
        var aheads,bheads,atails,btails;
        if(strict){
            aheads = [];
            atails = _.filter(syla.next_neighbors,function(n){return n.parent.sentence === syla.parent.sentence;});
            bheads = [];
            btails = _.filter(sylb.next_neighbors,function(n){return n.parent.sentence === sylb.parent.sentence;});
        } else {
            aheads = syla.head_neighbors;
            atails = syla.tail_neighbors;
            bheads = sylb.head_neighbors;
            btails = sylb.tail_neighbors;
            aheads = _.filter(aheads,function(n){return n.parent.sentence === syla.parent.sentence || _.contains(syla.prev_neighbors,n);});
            atails = _.filter(atails,function(n){return n.parent.sentence === syla.parent.sentence || _.contains(syla.next_neighbors,n);});
            bheads = _.filter(bheads,function(n){return n.parent.sentence === sylb.parent.sentence || _.contains(sylb.prev_neighbors,n);});
            btails = _.filter(btails,function(n){return n.parent.sentence === sylb.parent.sentence || _.contains(sylb.next_neighbors,n);});
        }
        if(typeof(vs) !== "undefined"){
            aheads = _.intersection(aheads,vs);
            atails = _.intersection(atails,vs);
            bheads = _.intersection(bheads,vs);
            btails = _.intersection(btails,vs);
        }

        var shares_head_pattern = _.some(aheads,function(na){
                return _.some(bheads,function(nb){
                    return na.color === nb.color && na.color > 0 && nb.color > 0;
                });
            }),
            shares_tail_pattern = _.some(atails,function(na){
                return _.some(btails,function(nb){
                    return na.color === nb.color && na.color > 0 && nb.color > 0;
                });
            }),
            both_end;
        if (strict){
            both_end = (syla.end_word && sylb.end_word && syla.end_syl && sylb.end_syl);
        } else {
            both_end = (syla.end_word && sylb.end_word && syla.index == sylb.index);
        }
        return shares_head_pattern || shares_tail_pattern || both_end;
    }

    // **cullJunk**
    //
    // Eliminate bad rhymes from the graph and weaken other poor rhymes
    function cullJunk(syla,words,G){
        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(sylb){
                    if(isRelated(syla,sylb,G)){
                        var is_in_pattern = isInPattern(syla,sylb,G);
                            edge = G.adj.get(syla.label()).get(sylb.label());
                        if (! isClose(syla,sylb,is_in_pattern) && !edge.rep){
                            G.removeEdge(syla.label(),sylb.label());
                        } else if (!edge.safe && !is_in_pattern){
                            G.removeEdge(syla.label(),sylb.label());
                        } else if (isJunk(syla,sylb) && (! is_in_pattern || ! isClose(syla,sylb))){
                            G.removeEdge(syla.label(),sylb.label());
                        } else if (isJunk(syla,sylb) && (! is_in_pattern || ! isClose(syla,sylb))){
                            G.removeEdge(syla.label(),sylb.label());
                        } else if (! isClose(syla,sylb) && ! edge.rep){
                            var weight = edge.weight;
                            if (is_in_pattern){
                                edge.weight = weight * 0.75;
                            } else {
                                edge.weight = weight * 0.5;
                            }
                        }

                        if(isRelated(syla,sylb,G) && edge.split && ! is_in_pattern && ! edge.rep){
                            edge.weight = suffixScore(syla,sylb,edge.vs || 0,true)[0][0] * edge.vs * edge.stress * 4;
                            edge.frozen = true;
                        }
                        if (isRelated(syla,sylb,G) && G.adj.get(syla.label()).get(sylb.label()).weight < 0.1){
                            G.removeEdge(syla.label(),sylb.label());
                        }

                        if(isRelated(syla,sylb,G) && edge.split && ! edge.real_match && ! is_in_pattern){
                            edge.weight = edge.weight * 0.2 * (1 + SCALE);
                            edge.frozen = true;
                        }

                        if(isRelated(syla,sylb,G) && edge.split && ! edge.real_match && edge.vs < 1){
                            edge.weight = edge.weight * 0.2 * (1 + SCALE);
                            edge.frozen = true;
                        }

                    }
                });
            });
        });
    }

    // **structureInfluence**
    //
    // Strengthen the relationship between syllables that occur in rhyme-rich
    // contexts.
    function structureInfluence(syla,words,G){
        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(sylb){
                    if(isDiff(syla,sylb) && isRelated(syla,sylb,G)){
                        var current_edge_data = G.adj.get(syla.label()).get(sylb.label()),
                            weight = current_edge_data.weight,
                            rep = current_edge_data.rep,
                            shares_head_pattern = _.some(syla.prev_neighbors,function(na){
                                return _.some(sylb.prev_neighbors,function(nb){
                                    return isRelated(na,nb,G);
                                });
                            }),
                            shares_tail_pattern = _.some(syla.next_neighbors,function(na){
                                return _.some(sylb.next_neighbors,function(nb){
                                    return isRelated(na,nb,G);
                                });
                            });

                        if(! rep && (shares_head_pattern || shares_tail_pattern) && ! current_edge_data.frozen){
                            current_edge_data.weight = weight + 0.25 * weight;
                        }
                        if(syla.end_word && sylb.end_word && ! current_edge_data.frozen && (shares_head_pattern || shares_tail_pattern)){
                            //current_edge_data.weight = weight + 0.5*weight
                        }

                    }
                });
            });
        });
    }

    // **totalMark**
    //
    // Sum all relationships going into a given syllable. Used to select which pronunciation offers 
    // the most rhyming possibilities
    function totalMark(syl,G){
        var total_mark = 0;
        G.adj.get(syl.label()).forEach(function(e,k){
            total_mark += e.weight;
        });
        syl.total_mark = total_mark;
    }

    // **findMatches**
    //
    // Identify and score all rhymes and then contextually clean up the graph
    function findMatches(words){
        var G = new jsnx.Graph();
        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(syl){
                    G.addNode(syl.label());
                    G.addNode("*" + syl.label());
                    G.addEdge(syl.label(),"*"+syl.label());
                    G.adj.get(syl.label()).get("*" + syl.label()).weight = 0.5;
                    G.adj.get(syl.label()).get("*" + syl.label()).rep = true;
                    G.adj.get(syl.label()).get("*" + syl.label()).vs = 1;
                    G.adj.get(syl.label()).get("*" + syl.label()).stress = 1;
                    G.adj.get(syl.label()).get("*" + syl.label()).safe = true;
                });
            });
        });

        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(syl){
                    calculateRhymes(syl,words,G);
                });
            });
        });

        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(syl){
                    cullJunk(syl,words,G);
                });
            });
        });

        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(syl){
                    structureInfluence(syl,words,G);
                });
            });
        });

        _.each(words,function(w){
            _.each(w.pros,function(p){
                _.each(p,function(syl){
                    totalMark(syl,G);
                });
            });
        });
        return G;
    }

    // **notBasicRep**
    //
    // Return whether or not a syllable actually rhymes or is used in a complex
    // rhyme pattern or is simply a repetition of a syllable
    function notBasicRep(s,G,syl_dict,vs){
        if(typeof(vs) === "undefined"){
            vs = false;
        }
        if(s.parent.pros[s.pro_index].length === 1 && ! _.contains(boringWords, s.parent.word)){
            return true;
        }
        var edges = G.adj.get(s.label()),
            rhymes = [],
            reps = [];

        edges.forEach(function(e,label){
            if (! e.rep){
                rhymes.push(label);
            } else if (e.rep && label[0] !== "*"){
                reps.push(label);
            }
        });

        if(vs){
            rhymes = _.intersection(rhymes,vs);
            reps = _.intersection(reps,vs);
        }
        return rhymes.length > 0 || _.some(reps,function(r){
            return isInPattern(s,syl_dict[r],G) || (s.parent.end_word && s.end_syl && syl_dict[r].parent.end_word && syl_dict[r].end_syl);
        });
    }

    // **listLabels**
    //
    // Debugging function to list the labels for every syllable
    function listLabels(syls){
        _.each(syls,function(s){
            console.log(s.label(),s.sounds.join("-"));
        });
    }

    // **debugGraph**
    //
    // Debugging function to examine all edges coming out of a given node
    function debugGraph(G,l){
        console.log("DEBUGGING",l);
        if(G.adj.get(l)){
            G.adj.get(l).forEach(function(e,label){
                if(label[0] !== "*"){
                    console.log(label,e.weight,syl_dict[label].sounds.join("-"));
                }
            });
        }
    }

    // **makeClusters**
    //
    // Cluster the graph of syllables using a Markov Clustering algorithm
    function makeClusters(syl_dict,G,mcl){
        var clustered = mcl.clustering(),
            final_partition = {},
            inv_partition = {};
        _.each(clustered,function(cluster,v){
            _.each(cluster,function(k){
                if(k[0] !== "*"){
                    var syl = syl_dict[k];
                    if (notBasicRep(syl,G,syl_dict) && ! _.contains(stopWords,syl.parent.word)){
                        if(! inv_partition[v]){
                            inv_partition[v] = [];
                        }
                        inv_partition[v].push(k);
                    }
                }
            });
        });
        var i = 1;

        _.each(inv_partition,function(v,k){
            if(v.length > 2){
                final_partition[i] = v;
                i+= 1;
            } else if(v.length == 2 && ! _.some(v, function(s){ return _.contains(boringWords, syl_dict[s].parent.word) && ! isInPattern(syl_dict[v[0]],syl_dict[v[1]],G);})){
                final_partition[i] = v;
                i+= 1;
            }
        });

        return final_partition;
    }

    // **clusterColor**
    //
    // Assign a color to each cluster
    function clusterColor(final_partition){
        _.each(syl_dict,function(v,k){
            v.color = 0;
        });
        _.each(final_partition,function(matches,color){
            _.each(matches,function(m){
                syl_dict[m].color = Number(color) + 1;
            });
        });
    }

    // **pickWinners**
    //
    // Select the pronunciation of each word that offers the highest rhyme scores
    function pickWinners(sentences){
        var all_syls = [],
            flat_syls = [],
            color_groups = [];

        _.each(sentences,function(sentence){
            var sent_syls = [];

            _.each(sentence,function(word){
                var syls = [];
                if (_.every(word.pros,function(p){return p.length == word.pros[0].length;})){
                    if(_.isEmpty(word.pros)){
                        console.log("No pronunciation for",word);
                    }

                    _.each(word.pros[0],function(syl,i){
                        var alts = _.map(word.pros,function(p){return p[i];}),
                            winner = _.max(alts,function(x){return x.total_mark;});
                        syls.push(winner);
                    });
                } else {
                   syls = _.max(word.pros, function(p){return _.reduce(p,function(m,syl){return m + syl.total_mark;},0);});
                }

                flat_syls = flat_syls.concat(syls);
                sent_syls.push(syls);
            });
            all_syls.push(sent_syls);
        });
        return [all_syls, flat_syls];
    }

    // **tumble**
    //
    // Continually eliminate bad members of a rhyme group until the group converges,
    // until no further bad memebers are removed
    function tumble(group,G,syl_dict){
        var dels = [],
            final_items;

        _.each(group,function(syl){
            var vs = _.map(group,function(s){return s.label();});
            if(! notBasicRep(syl,G,syl_dict,vs)){
                syl.color = 0;
                dels.push(syl);
            }
        });

        final_items = _.filter(group,function(i){return ! _.contains(dels,i);});

        if(final_items.length <= 1){
            _.each(final_items,function(syl){
                syl.color = 0;
            });
            final_items = [];
        }

        if (_.isEqual(final_items,group)){
            return final_items;
        } else {
            return tumble(final_items,G,syl_dict);
        }
    }

    // **cullGroupJunk**
    //
    // Remove members a group that have very poor relationships to every other 
    // member of the group, outliers that got accidentally included
    function cullGroupJunk(fgroup,G,syl_dict){
        var dels = [];

        _.each(fgroup,function(syla){
            var others = _.without(fgroup,syla);
            if (_.every(others,function(sylb){
                var is_in_pattern = isInGroupPattern(syla,sylb,false),
                    edge = G.adj.get(syla.label()).get(sylb.label());
                return (edge && ! isClose(syla,sylb,is_in_pattern) && ! edge.rep);
            })){
                dels.push(syla);
                syla.color = 0;
            }

            if (_.every(others,function(sylb){
                var is_in_pattern = isInGroupPattern(syla,sylb,false),
                    edge = G.adj.get(syla.label()).get(sylb.label());
                return (edge && edge.split && ! edge.real_match && ! is_in_pattern);
            })){
                dels.push(syla);
                syla.color = 0;
            }

            if (_.every(others,function(sylb){
                var is_in_pattern = isInGroupPattern(syla,sylb,false),
                    edge = G.adj.get(syla.label()).get(sylb.label());
                return (edge && ! edge.safe && ! is_in_pattern);
            })){
                dels.push(syla);
                syla.color = 0;
            }
        });
        return _.difference(fgroup,dels);
    }

    // **cleanFinalColors**
    //
    // Pass each rhyme group through several cleaning stages to ensure a high quality of output
    function cleanFinalColors(final_syls,G,syl_dict){
        var final_groups = {},
            last_groups = {},
            tumbled_groups = {};

        _.each(final_syls,function(syl){
            if(! final_groups[String(syl.color)]) {
                final_groups[String(syl.color)] = [];
            }
            final_groups[String(syl.color)].push(syl);
        });

        _.each(final_groups,function(fgroup,k){
            var final_items = tumble(fgroup,G,syl_dict);
            if(final_items.length > 1){
                tumbled_groups[k] = final_items;
            }
        });

        _.each(tumbled_groups,function(fgroup,k){
            var not_base = fgroup[0].color > 0,
                final_items = fgroup;
            if(not_base){
                final_items = cullGroupJunk(fgroup,G,syl_dict);
            }
            if(final_items.length > 1){
                last_groups[k] = final_items;
            } else {
                _.each(final_items,function(syl){
                    syl.color = 0;
                });
            }
        });

        return last_groups;
    }

    // **pruneGraph**
    //
    // Eliminate rhymes with high incidental rhyme scores that are unlikely to be
    // true rhymes given context clues
    function pruneGraph(G,final_groups,syl_dict){
        var all_colored = [];
        _.each(final_groups,function(g,k){
            if(k > 0){
                all_colored = all_colored.concat(_.map(g,function(s){return s.label();}));
            }
        });

        var remainder = _.map(all_colored,function(a){return syl_dict[a];});
        _.each(all_colored,function(n){
            var max_weight = 0,
                max_color = 0,
                max_good_color = 0,
                good_colors = [],
                max_good_weight = 0,
                max_good_syl = false,
                kill_unsafe = false;
            G.adj.get(n).forEach(function(edge,k){
                if(_.contains(all_colored,k)){
                    if (edge.weight > max_weight && k[0] !== "*"){
                        max_weight = edge.weight;
                        max_color = syl_dict[k].color;
                    }
                    if (edge.weight > max_good_weight && k[0] !== "*" && edge.safe){
                        max_good_weight = edge.weight;
                        max_good_color = syl_dict[k].color;
                        max_good_syl =  syl_dict[k];
                        good_colors = _.union(good_colors,syl_dict[k].color);
                    }
                    if (edge.safe && edge.weight > (max_weight * 0.5)){
                        good_colors = _.union(good_colors,[syl_dict[k].color]);
                    }

                }
            });
            if (max_good_weight > 0.75 * max_weight){
                kill_unsafe = true;
            }
            G.adj.get(n).forEach(function(edge,k){
                if(k[0] != "*"){
                    var syla = syl_dict[n],
                        sylb = syl_dict[k],
                        near_neighbors = syla.prev_neighbors.concat(syla.next_neighbors).concat(sylb.prev_neighbors).concat(sylb.next_neighbors);
                    if(!edge.safe && ! isInGroupPattern(syla,sylb,true,remainder)){
                        G.removeEdge(syla.label(),sylb.label());
                    } else if(!edge.safe && kill_unsafe && good_colors.length > 1){
                        G.removeEdge(syla.label(),sylb.label());
                    } else if (edge.split && !edge.real_match && ! isInGroupPattern(syla,sylb,true,remainder)){
                        G.removeEdge(syla.label(),sylb.label());
                    } else if (edge.split && isInGroupPattern(syla,sylb,false,remainder) && ! edge.rep && syla.suffix.length === 0 && sylb.suffix.length === 0){
                    } else if (edge.split && ! isInGroupPattern(syla,sylb,true,remainder) && ! edge.rep){
                        edge.weight = suffixScore(syla,sylb,edge.vs || 0,true)[0][0] * edge.vs * edge.stress * 4;
                        edge.frozen = true;
                    } else if(edge.vs < 0.5 && ! isInGroupPattern(syla,sylb,false,near_neighbors) && !(syla.parent.end_word && syla.end_syl && sylb.parent.end_word && sylb.end_syl) && !edge.frozen){
                        edge.weight = edge.weight * 0.75;
                        edge.frozen = true;
                    }
                }
            });
        });
    }

    // **translateWord**
    //
    // Given an original English word and the arpabet syllables, attempt to syllablize the raw
    // English word
    function translateWord(phoword,parsed_syls){
       var raw_word = phoword.word,
           num_syls = parsed_syls.length,
           vowels = /[aeiouy]/i,
           vowel_indices = [],
           chunked_vowels = [],
           last_vowel = -2,
           syl_vowels;

           var isVowel = function(c){
             return c.match(/[aeiouy]/g);
           };

           var isCons = function(c){
             return c.match(/[^aeiou]/g);
           };

           var consume = function(hopper,segment,syl,next_syl,sufflen){
             var hopper_chrs,next_vowel;

             if(hopper.length < 1){
                 // If there's no hopper left, we are done
                return [hopper,segment];
             } else if(sufflen < 1 && _.contains(["EY","AY","IY"],destress(syl.vowel)) && hopper[0].match(/y/i)){
                segment = segment + hopper[0];
                hopper = hopper.slice(1);
                return consume(hopper,segment,syl,next_syl,sufflen);
             } else if(sufflen < 1 && _.contains(["EY","AY","IY"],destress(syl.vowel)) && hopper[0].match(/r/i) && hopper[1] && hopper[1].match(/e/i)){
                return [hopper,segment];
             } else if(_.isEqual(syl.suffix,["L"]) && segment.slice(-2).match(/le/i) && destress(syl.vowel) === "AH"){
                return [hopper,segment];
             } else if(sufflen < 1 && isVowel(hopper[0]) && next_syl.prefix.length === 0){
                 // If there's no suffix, but the hopper starts on a vowel and so does the next syl, we are done
                return [hopper,segment];
             } else if(sufflen < 1 && isVowel(hopper[0]) && next_syl.prefix.length > 0){
                // If there's no suffix, but the hopper starts on a vowel and the next syl doesn't, consume until cons
                var next_cons = _.findIndex(hopper.split(""),isCons);
                segment = segment + hopper.slice(0,next_cons);
                hopper = hopper.slice(next_cons);
                return [hopper,segment];
             } else if(sufflen < 1 && ! isVowel(hopper[0]) && next_syl.prefix.length === 0){
                // If there's no suffix and the hopper doesn't start on a vowel, consume cons until vowel, assuming they are silent
                hopper_chrs = hopper.split("");
                next_vowel = _.findIndex(hopper_chrs, function(c,i){return isVowel(c) && ! (c.match(/u/i) && hopper_chrs[i-1] && hopper_chrs[i-1] == "q");});
                segment = segment + hopper.slice(0,next_vowel);
                hopper = hopper.slice(next_vowel);
                return [hopper,segment];
             } else if(sufflen < 1 && ! isVowel(hopper[0]) && next_syl.prefix.length > 0){
                 // If there's no suffix and the hopper and next_syl both start on cons, we are done
                if (hopper.slice(0,2).match(/gh/i)){
                    segment = segment + hopper.slice(0,2);
                    hopper = hopper.slice(2);
                }
                return [hopper,segment];
             } else if(sufflen >= 1 && isVowel(hopper[0])){
                // If there's a suffix left, but the hopper is starting on a vowel, we haven't eaten enough vowels
                segment = segment + hopper[0];
                hopper = hopper.slice(1);
                return consume(hopper,segment,syl,next_syl,sufflen);
             } else if(sufflen >= 1 && ! isVowel(hopper[0]) && next_syl.prefix.length === 0){
                // If there's a suffix left and the hopper has consonants left but the next_syl has no prefix, consume til vowel
                hopper_chrs = hopper.split("");
                next_vowel = _.findIndex(hopper_chrs, function(c,i){return isVowel(c) && ! (c.match(/u/i) && hopper_chrs[i-1] && hopper_chrs[i-1] == "q");});
                segment = segment + hopper.slice(0,next_vowel + 1);
                hopper = hopper.slice(next_vowel + 1);
                return [hopper,segment];
             } else if(sufflen >= 1 && ! isVowel(hopper[0]) && next_syl.prefix.length > 0){
                // If there's a suffix left and the consonants have to be divided get trickier
                if(syl.suffix.join("").match(/ks/i) && hopper[0].match(/x/i)){
                    segment = segment + hopper[0];
                    hopper = hopper.slice(1);
                    return consume(hopper,segment,syl,next_syl,sufflen-2);
                } else if (_.contains(syl.suffix, "CH") && hopper.slice(0,2) == "ch" || 
                           _.contains(syl.suffix, "TH") && hopper.slice(0,2) == "th" ||
                           _.contains(syl.suffix, "DH") && hopper.slice(0,2) == "th"){
                    segment = segment + hopper.slice(0,2);
                    hopper = hopper.slice(2);
                    return consume(hopper,segment,syl,next_syl,sufflen-2);
                } else {
                    segment = segment + hopper[0];
                    hopper = hopper.slice(1);
                    return consume(hopper,segment,syl,next_syl,sufflen-1);
                }
             }

           };

           var split = _.reduce(parsed_syls,function(m,syl,i){
             var hopper = m[0],
                 output_syls = m[1],
                 prelen = syl.prefix.length,
                 sufflen = syl.suffix.length,
                 vowel = destress(syl.vowel),
                 hopper_chrs = hopper.split(""),
                 next_possible_vowel = _.findIndex(hopper_chrs, function(c,i){return isVowel(c) && ! (c.match(/u/i) && hopper_chrs[i-1] && hopper_chrs[i-1] == "q");}),
                 next_syl,
                 segment = "";
             if(prelen > next_possible_vowel){
                console.log("WARNING", "Too many cons",raw_word);
             }
             if(i === (parsed_syls.length - 1)){
                return ["",output_syls.concat([hopper])];
             } else {
                next_syl = parsed_syls[i+1];
             }

             if(hopper[0].match(/s/i) && hopper[1] && hopper[1].match(/m/i) && _.isEqual(syl.prefix, ["S"]) && _.isEqual(syl.suffix, ["M"])){
                output_syls.push("sm");
                return [hopper.slice(2),output_syls];
             } else if (hopper[0].match(/s/i) && hopper[1] && hopper[1].match(/m/i) && _.isEqual(syl.prefix, ["S"]) && _.isEqual(syl.suffix, []) && next_syl.sounds[0].match(/m/i)){
                output_syls.push("s");
                return [hopper.slice(1),output_syls];
             }

             segment = segment + hopper.slice(0,next_possible_vowel + 1);
             hopper = hopper.slice(next_possible_vowel + 1);
             if(vowel === "ER" && hopper[0].match(/r/i)){
                segment = segment + hopper.slice(0,1);
                hopper = hopper.slice(1);
             }
             var division = consume(hopper,segment,syl,next_syl,sufflen);
             output_syls.push(division[1]);
             return [division[0],output_syls];

           },[phoword.word,[]]);

           return split;
    }

    // **assignWord**
    //
    // Map a the Syls of a Phoword onto the real English syllables of the original word
    function assignRealSyls(sentences, raw_sentences){
        return _.map(sentences,function(sentence,sentence_index){
            return _.map(sentence,function(word,word_index){
                var parsed_syls = word,
                    phoword = raw_sentences[sentence_index][word_index];
                return [word,translateWord(phoword,parsed_syls)[1]];
            });
        });
    }

    // **calcTotalDistance
    //
    // Evaluate the aesthetic quality of a rhyme group ordering
    function calcTotalDistance(groups,syls){
        var start_color = syls.length > 0 ? syls[0].color : 0;
        return _.reduce(syls.slice(1),function(m,i){
          var total = m[0],
              last_color = m[1],
              two_last_color = m[2],
              color = groups.indexOf(i.color),
              d,distance;
          if(color < 0){
            distance = 0;
          } else if (color >= 0 && last_color >= 0 && two_last_color >= 0 && (Math.abs(color - last_color) == 1 || color === last_color) && (Math.abs(last_color - two_last_color) == 1 || two_last_color === last_color) && Math.abs(color - two_last_color) <= 2){
            distance = -1;
          } else if (color >= 0 && last_color >= 0){
            d = Math.abs(color - last_color);
            distance = d === 0 || d === 1 ? 0 : d;
          } else if (color >= 0 && last_color < 0 && two_last_color >= 0){
            d = Math.abs(color - two_last_color);
            distance = d === 0 || d === 1 ? 0 : d;
          } else {
            distance = 0;
          }
              //distance = color < 0 || last_color < 0 ? 0 : Math.abs(color - last_color);
          //console.log(last_color,color,distance,total)
          return [total + distance,color,last_color];
        },[0,groups.indexOf(start_color),-1])[0];
    }

    // **anneal**
    //
    // Anneal the ordering of rhyme groups to produce an aesthetically pleasing output
    function anneal(groups,syls){
      var temp = 4,
          i = 0,
          score = calcTotalDistance(groups,syls),
          states = [],
          from,to,a,b,rule,p,candp,candidate,theta,state;
      while(i < 1000 && score > 5){
        p = Math.random();
        from = Math.floor(Math.random() * groups.length);
        to = Math.floor(Math.random() * (groups.length));
        candidate = _.clone(groups);
        a = candidate[from];
        b = candidate[to];

        candidate[from] = b;
        candidate[to] = a;
        newscore = calcTotalDistance(candidate,syls);
        theta = score-newscore;
        candp = 1/(1+(Math.pow(Math.E,-1*(theta/temp))));
        if (candp > p) {
          groups = candidate;
          score = newscore;
        }
        temp = temp * Math.pow(Math.E,-0.02);
        i++;
      }
      return groups;
    }

    // **orderColors**
    //
    // Determine an ordering for the rhyme families, in order to produce a visualization that makes
    // long multi-syllabic rhymes easy to recognize
    function orderColors(groups,syls){
        var final_winner;

        groups = _.without(groups,0);
        final_winner = anneal(groups,syls);
        return final_winner;
    }

    var textTemplate = _.template(document.getElementById("text-viz").innerHTML);
    var barTemplate = _.template(document.getElementById("bar-viz").innerHTML);

    // **showColors**
    //
    // A visual debugging output
    function showColors(sentences,syls){
        var total_groups = 0,
            groups = [],
            words = document.getElementById("words"),
            bars = document.getElementById("bars"),
            colors = {
                "0": "#ffffff",
                "1": "#DFBA24",
                "2": "#D87E3B",
                "3": "#57D0CA",
                "4": "#CA3E6B",
                "5": "#278FBD",
                "6": "#A5BB51",
                "7": "#7C8BC5",
                "8": "#fdc47c",
                "9": "#AB4097",
                "10": "#543192",
                "11": "#51A587",
                "12": "#FFB0B1",
                "13": "#D4CB8B",
                "14": "#D27481",
                "15": "#B15FC1",
                "16": "#F39B84",
                "17": "#6F7F6C",
                "18": "#F29031",
                "19": "#704FD0",
                "*": "#cecece"
            };

        var final_syls = [],
            last_sentence = 0,
            dim;

        _.each(syls,function(s){
            if(! _.contains(groups,s.color)){
                groups.push(s.color);
            }
            if(s.parent.sentence !== last_sentence){
                final_syls.push({color: "*"});
                last_sentence = s.parent.sentence;
            }
            final_syls.push(s);
        });

        groups = orderColors(groups,final_syls);

        dim = document.getElementById("bars").offsetWidth / final_syls.length * 0.9;
        groups = _.filter(groups,function(g){return g !== 0;});
        words.innerHTML = textTemplate({sentences: sentences, colors: colors});
        bars.innerHTML = barTemplate({groups: groups, syls: final_syls, colors: colors, dim: dim});

        return groups;
    }

    // **writeArray**
    //
    // Translate the output of the algorithm into a CSV
    function writeArray(sentences,syls){
        var groups = [],
            output = [],
            last_sentence = 0,
            dim;

        _.each(syls,function(s){
            if(! _.contains(groups,s.color)){
                groups.push(s.color);
            }
        });

        groups = orderColors(groups,syls);

        _.each(sentences,function(sentence,sentence_index){
            _.each(sentence,function(word,word_index){
                var pho_syls = word[0],
                    real_syls = word[1];
                _.each(pho_syls,function(syl,syl_index){
                    var real_syl = real_syls[syl_index],
                        space = syl.end_syl ? "1" : "0",
                        color_index = groups.indexOf(syl.color),
                        classed = color_index >= 0 ? String(color_index + 1) : "0",
                        linebreak = syl.end_syl && syl.end_word ? "1" : "0",
                        text = real_syl,
                        timecode = output.length;
                    output.push({"classed": classed, "linebreak": linebreak, "space": space, "text": text, "timecode": timecode});
                });
            });
        });

        return output;
    }

    function init(syllines){
        var syldict = {};

        _.each(syllines,function(line){
            var pieces = line.split(" "),
                word = pieces[0].toLowerCase(),
                sylls = _.map(pieces.slice(1).join(" ").split("-"),function(s){
                    return s.trim();
                });
             syldict[word] = sylls;
        });
        window.syldict = syldict;
    }


    window.RAP = {
        analyze: analyze,
        debugGraph: debugGraph
    };

    window.RAP.nicki = function(t){
        document.getElementById("lyrics").value = "Pull up in the monster\nAutomobile gangster\nWith a bad bitch that came from Sri Lanka\nYeah I’m in that Tonka, color of Willy Wonka\nYou could be the King but watch the Queen conquer";
        document.getElementById("fader").value = 2;
    };

    window.RAP.chance = function(t){
        document.getElementById("lyrics").value = "you can feel the lyrics, the spirit coming in braille\nTubman of the underground, come and follow the trail\nI made Sunday Candy, I'm never going to hell\nI met Kanye West, I'm never going to fail";
        document.getElementById("fader").value = 3;
    };

    window.RAP.bey = function(t){
        document.getElementById("lyrics").value = "Y'all haters corny with that Illuminati mess\nPaparazzi, catch my fly, and my cocky fresh\nI'm so reckless when I rock my Givenchy dress\nI'm so possessive so I rock his Roc necklaces";
        document.getElementById("fader").value = 2;
    };

    window.RAP.jay = function(t){
        document.getElementById("lyrics").value = "Psycho: I'm liable to go Michael, take your pick\nJackson, Tyson, Jordan, Game six\nGot a broken clock, Rollies that don't tick tock\nAudemars that's losing time, hidden behind all these big rocks";
        document.getElementById("fader").value = 2;
    };

    window.RAP.salt = function(t){
        document.getElementById("lyrics").value = "Yes, I'm blessed, and I know who I am\nI express myself on every jam\nI'm not a man, but I'm in command\nHot damn, I got an all-girl band";
        document.getElementById("fader").value = 2;
    };

    window.RAP.jewels = function(t){
        document.getElementById("lyrics").value = "The passion of Pac, the depth of Nas, circa nine three\nMix the mind of Brad Jordan and Chuck D and find me\nI spit with the diction of Malcolm or say a Bun B\nPrevail through Hell, so Satan get ye behind me";
        document.getElementById("fader").value = 2;
    };

    window.RAP.kim = function(t){
        document.getElementById("lyrics").value = "Push the keys, G's threes for pape's,\nYeah, I ride crate state to state\nLieutenant takes mad dimes from New York to Anaheim\nWhile you daydream and whine, I just keep gettin mine";
        document.getElementById("fader").value = 2;
    };

    window.RAP.pun = function(t){
        document.getElementById("lyrics").value = "Dead in the middle of Little Italy little did we know\nThat we riddled two middlemen who didn’t do diddly";
        document.getElementById("fader").value = 2;
    };

    window.RAP.lauryn = function(t){
        document.getElementById("lyrics").value = "It's funny how money change a situation\nMiscommunication lead to complication\nMy emancipation don't fit your equation\nI was on the humble you on every station";
        document.getElementById("fader").value = 2;
    };

    window.RAP.raekwon = function(t){
        document.getElementById("lyrics").value = "Egyptian, brown skin brown suede Timbs\nMasqueradin' X-rated throw blades, all occasions\nRound nozzle touchdown, Haagen-Dazs goggles White House\nGucci flag on the roof, call us rock groups";
        document.getElementById("fader").value = 2;
    };

    window.RAP.tribe = function(t){
        document.getElementById("lyrics").value = "Yo, microphone check one, two, what is this?\nThe five foot assassin with the roughneck business\nI float like gravity, never had a cavity\nGot more rhymes than the Winans got family";
        document.getElementById("fader").value = 2;
    };

    window.RAP.biggie = function(t){
        document.getElementById("lyrics").value = "We used to fuss when the landlord dissed us\nNo heat, wonder why Christmas missed us\nBirthdays was the worst days\nNow we sip champagne when we thirstay";
        document.getElementById("fader").value = 2;
    };

    window.RAP.lafayette = function(t){
        document.getElementById("lyrics").value = "I’m takin' this horse by the reins makin’\nRedcoats redder with bloodstains\nAnd I’m never gonna stop until I make ‘em\nDrop and burn ‘em up and scatter their remains";
        document.getElementById("fader").value = 2;
    };

    // ** createMCL **
    //
    // Create a new clustering, copying an extant rhyme graph
    function createMCL(syllables,G,p){
        var mcl = new MCL({inflates: p});
        _.each(syllables,function(s,i){
            var node = G.adj.get(s.label());
            G.adj.get(s.label()).forEach(function(e,label){
                if (label[0] !== "*" && _.some(syllables,function(si){return si.label() === label;})){
                    mcl.setEdge(s.label(),label,e.weight);
                }
            });
        });
        return mcl;
    }

    // **analyze**
    //
    // The main body of the rhyme analysis algorithm
    function analyze(tune){
        var loader = document.getElementById('loadloadloading');
        if(loader){
            loader.className = "active loadloadloading";
        }
        var theUserviz = document.getElementById('tunes-userviz');
        if(theUserviz){
            theUserviz.className += " faded";
        }
        var theUserVizError = document.getElementById('tunes-userviz-error');
        if(theUserVizError){
            theUserVizError.className = "hidden";
        }
        $('#tunes-userviz').removeClass('hidden');

        window.setTimeout(function(){
            if(typeof(tune) === "undefined"){
                tune = false;
            }
            
            // Load lyrics, split them into words and look them up in the pronunciation 
            // dictionary
            var lyrics = document.getElementById("lyrics").value.split("\n"),
                process = processText(lyrics.concat(["xxx"])),
                sounds = process[0],
                syllables = _.flatten(process[1]),
                words = process[2];

            // Determine if any words couldn't be looked up
            var missing_words = _.some(words,function(w){
                return w.pros.length === 0 && w.word != "xxx";
            });

            // Adjust for a strictness parameter
            mcl_param = document.getElementById("fader").value;
            window.SCALE = (mcl_param - 2)/3.5;

            // Put each syllable into a dictionary based on its label for easy
            // debugging and crossreference
            syl_dict = {};
            _.each(syllables,function(s,i){
                syl_dict[s.label()] = s;
            });

            // Assign each syllables its neighbors
            findNeighbors(words);

            // Assign each syllables its scored rhymes
            var G = findMatches(words);

            // Pick which pronunciations to use
            var winners = pickWinners(sounds),
                reduced_syls = winners[0],
                flat_syls = winners[1];

            // Run our first clustering into rhyme families
            var first_mcl = createMCL(flat_syls,G,2 + SCALE);
            var partition = makeClusters(syl_dict,G,first_mcl);
            clusterColor(partition);
            var groups = cleanFinalColors(flat_syls,G,syl_dict);

            var final_mcl,final_partition,final_groups;

            // Cluster an additional two times, pruning the graph between steps,
            // allowing the clustering to feedback into the graph and remove and weaken
            // contextually-weak rhymes
            _(2).times(function(){
                pruneGraph(G,groups,syl_dict);
                final_mcl = createMCL(flat_syls,G,2 + SCALE);
                final_partition = makeClusters(syl_dict,G,final_mcl);
                clusterColor(final_partition);
                final_groups = cleanFinalColors(flat_syls,G,syl_dict);
            });

            final_reduced_syls = assignRealSyls(reduced_syls,sounds);
            final_reduced_syls = final_reduced_syls.slice(0,-1);
            var csv = writeArray(final_reduced_syls,flat_syls);
            if(tune && tune !== -1){
                var userviz = new tune({
                    source:'',
                    file:'userviz',
                    title:'',
                    artist:'',
                    album:'',
                    data:csv,
                    show:true,
                    music:false,
                    container:'userviz',
                    missing_words: missing_words
                  });
            } else if (tune === -1) {
                showColors(final_reduced_syls,flat_syls);
            }
            //console.log(JSON.stringify(csv))
            //console.log("MISSING",missing_words)
                $('#tunes-userviz').removeClass('nada');
            $('#loadloadloading').removeClass('active');
            $('#tunes-userviz').removeClass('faded');

            if($('#tunes-userviz g[data-row=1]').length===0){
                console.log('nada');
                $('#tunes-userviz').addClass('hidden nada');
                $('#tunes-userviz-error').removeClass('hidden');
            }

            return csv;
        }, 500);

    }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI('cmudict.js'));
    xhr.onload = function() {
        if (xhr.status === 200) {

            var syllines = xhr.responseText.split("\n");
            init(syllines);
            i = 0;
        }
        else {
            console.log('Request failed.  Returned status of ' + xhr.status);
        }

    };
    xhr.send();
})();
