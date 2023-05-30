const fs = require('fs');
let jsonData = [
   
]

let emails = jsonData.map(function(item) {
    return item.email;
});

// create a Set to save unique emails
let uniqueEmails = [...new Set(emails)];

// create a string with each email address on a new line
let emailString = uniqueEmails.join('\n');

// write the string to a new file
fs.writeFile('emails.txt', emailString, function(err) {
    if(err) {
        console.log('There was an error writing the file.');
        console.log(err);
    } else {
        console.log('Unique emails saved to emails.txt');
    }
});
