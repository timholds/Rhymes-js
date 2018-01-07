PH = {}

PH.destress = function(str){
    return _.filter(str,function(s){return /[a-z]/i.test(s)}).join("")
}

W = new jsnx.Graph()
W.addNode("HH")
W.addWeightedEdgesFrom([
    ["P","T",0.75],
    ["P","K",0.85],
    ["P","B",0.8],
    ["T","K",0.8],
    ["T","D",0.8],
    ["T","S",0.55],
    ["T","G",0.65],
    ["K","B",0.65],
    ["K","G",0.7],
    ["F","TH",0.75],
    ["F","V",0.8],
    ["TH","V",0.65],
    ["TH","DH",0.75],
    ["S","SH",0.65],
    ["S","CH",0.4],
    ["SH","CH",0.8],
    ["S","Z",0.6],
    ["SH","ZH",0.55],
    ["JH","ZH",0.8],
    ["V","DH",0.75],
    ["V","ZH",0.7],
    ["V","JH",0.6],
    ["DH","ZH",0.75],
    ["DH","JH",0.65],
    ["DH","D",0.55],
    ["Z","ZH",0.8],
    ["Z","JH",0.7],
    ["B","D",0.7],
    ["B","G",0.75],
    ["D","G",0.7],
    ["M","N",0.8],
    ["M","NG",0.8],
    ["N","NG",0.75],
    ["NG","W",0.65],
    ["W","Y",0.7],
    ["W","R",0.7],
    ["W","L",0.7],
])

function diphthong(a){
    var ds = ["AY","EY","OW","AW","OY"]
    return _.contains(ds,PH.destress(a))
}

function suffCompare(a,b,a_vowel,b_vowel,both_end,both_good){
    var lena = a.length,
        lenb = b.length,
        same_vowel = PH.destress(a_vowel) == PH.destress(b_vowel),
        end_ception = same_vowel && both_end && diphthong(a_vowel) && diphthong(b_vowel),
        seqa,seqb,
        score;
    

    if ((lena && !lenb) || (lenb && !lena) && !end_ception && same_vowel && both_good){
        return [0.45,false]
    } else if ((lena && !lenb) || (lenb && !lena) && !end_ception && ! same_vowel && both_good){
        return [0.25,false]
    } else if ((lena && !lenb) || (lenb && !lena) && !end_ception){
        return [0,true]
    }

    if (lenb > lena){
        seqa = b
        seqb = a
    } else {
        seqa = a
        seqb = b
    }

    score = _.reduce(seqa,function(m,ch,i){
        if (i >= seqb.length && i > 0 && (ch == "Z" || ch == "S")){
            return 0.9 * m
        } else if (i >= seqb.length && same_vowel){
            return 0.75 * m
        } else if (i >= seqb.length && ! same_vowel){
            return 0.25 * m
        } else {
            var ss = soundSim(ch,seqb[i]) 
            if (i == 0 && ! same_vowel && ss < 0.9){
                ss = ss * 0.2
            }
            return ss * m
        }
    },1)

    return [score,true]
}

function soundSim(a,b){
    if(!a || !b){
        return 0
    }
    //console.log(a,b)
    var edge = W.adj.get(a).get(b)
    if (a === b){
        return 1
    } else if (edge){
        return (edge.weight - 0.4) * (5/3)
    } else {
        return 0
    }
}

PH.suffCompare = suffCompare
//console.log("SUFF TEST")
//console.log("T-T",suffCompare(["T"],["T"]))
//console.log("NS-NZ",suffCompare(["N","Z"],["N","S"]))
//console.log("N-NT",suffCompare(["N"],["N","T"]))
//console.log("N-M",suffCompare(["N"],["M"]))
//console.log("NZ-MS",suffCompare(["N","Z"],["M","S"]))
//console.log("PT-T",suffCompare(["P","T"],["T"]))
