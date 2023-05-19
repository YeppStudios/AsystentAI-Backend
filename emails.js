const fs = require('fs');
let jsonData = [

]

let emails = jsonData.map(function(item) {
    return item.email;
});

// create a string with each email address on a new line
let emailString = emails.join('\n');

// write the string to a new file
fs.writeFile('emails.txt', emailString, function(err) {
    if(err) {
        console.log('There was an error writing the file.');
        console.log(err);
    } else {
        console.log('Emails saved to emails.txt');
    }
});