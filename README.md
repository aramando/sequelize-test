# Test case for an obscure Sequelize SQL bug

1)  
  
    npm i && npm start
   
2) Empty results array should be logged (successful query).
3) Comment out any one of the four elements marked as BREAKING in `app.js` and re-run to see the error.
    
