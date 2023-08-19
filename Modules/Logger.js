var colorCodes = {
    "&": "&",
    " ": "& ",
    
    "0": "\x1b[38;2;0;0;0m",
    "1": "\x1b[38;5;21m",
    "2": "\x1b[38;5;42m",
    "3": "\x1b[38;5;116m",
    "4": "\x1b[38;5;160m",
    "5": "\x1b[38;5;128m",
    "6": "\x1b[38;5;214m",
    "7": "\x1b[38;5;252m",
    "8": "\x1b[38;5;243m",
    "9": "\x1b[38;5;39m",
    "a": "\x1b[38;5;154m",
    "b": "\x1b[38;5;87m",
    "c": "\x1b[38;5;196m",
    "d": "\x1b[38;5;212m",
    "e": "\x1b[38;5;226m",
    "f": "\x1b[38;5;231m",

    "r": "\x1b[0m",
    "l": "\x1b[1m",
    "m": "\x1b[9m",
    "n": "\x1b[4m",
    "o": "\x1b[3m",

    [undefined]: "&"
};

const $ = (content) => {
    if (!content instanceof String) {
        console.log(content);
        return;
    }
    
    var oldContent = "&r" + content + "&r";

    let newContent = "";
    for (let i = 0; i < oldContent.length; ++i) {
        if (oldContent[i] == "&") {
            i += 1;
            newContent += colorCodes[oldContent[i]];
        }
        else {
            newContent += oldContent[i];
        }
    }

    console.log(newContent);
    return newContent;
};

module.exports = $;