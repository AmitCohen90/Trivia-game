import express from "express";
import axios from "axios";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";
//importing all the relevant modules

const __dirname = dirname(fileURLToPath(import.meta.url)); /*holds the directory name of the current module
referencing files or resources relative to the current module's location*/ 

const app = express();
const port = 3000;
var questionsArray; /*Array in which we are going to push all the questions in accordance to what the user
                      selected*/
var optionsArray; //Array in which we are goin to push all the possible options to a question

var listOfAllCategories = null; 
var result; //The result we are going to receive from the API

const API_URL = "https://opentdb.com/api.php";//The resource we are going to use

app.use(express.static("public")); //use the express.static middleware to serve static files from the "public"
                                   //directory

app.use(bodyParser.urlencoded({ extended: true })); //Making req.body accessible.

function categoryNameToCategoryNumber(categoryName, listOfCategories){/*This function receives a category name
and array of list of all categories. It returns the id of the category in the repository*/
    for(let i = 0 ; i < listOfCategories.length; i++){
        if(listOfCategories[i].name === categoryName){
            return listOfCategories[i].id;
        }
    }
}

function shuffleOptions(options){/*This function receives an array of possible options and it shuflles it. This
                                   function is meant for multiple choice type of questions*/
    let temp = "";
    let j;
    for (let i = options.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        temp = options[i];
        options[i] = options[j];
        options[j] = temp;
  }//The process is simple: using a temp variable and swaping between two cells using Math.random
}

function orderBoolean(options){ /*Receives an array of options (meant fro true/false type of qeustions) and arrange
                                  it so first option will be true and second option will be false */
    if(options[0] === "False"){
        options[0] = "True";
        options[1] = "False";
    }
}

app.get("/", async (req, res) => {
    try{
        listOfAllCategories = await axios.get("https://opentdb.com/api_category.php");
        listOfAllCategories = listOfAllCategories.data.trivia_categories; /*listOfAllCategories is now and array
                                                                            of all categories*/
    } catch(error) {
        console.log(error.data);
    }
    res.render(__dirname + "/views/index.ejs"); //Uploading the page
});

app.post("/", async (req,res) => {
    if(req.body.button === "Start"){ //If the user clicked the "Start" button
        const numberToDisplay = parseInt(req.body.number, 10); //Number of questions the user selected
        const categoryToDisplay = req.body.category; //category of questions the user selected
        const difficultyToDisplay = req.body.difficulty; //difficulty of questions the user selected
        const typeToDisplay = req.body.type; //type of questions the user selected
        //We use the suffix "ToDisplay" because we are going to use it to display it in our websit

        var categoryNumberForUrl; //The category number we are going to add to the url
        var difficultyNameForUrl; /* The difficulty name before we will add it to the url. We use this variable
                                     because we need a certain format to the url*/
        var typeNameForUrl; // The type of questions we are going to add to the url
        var generatedURL = `${API_URL}?amount=${numberToDisplay}`; //Adding the number of questions to the url
        if(categoryToDisplay !== "Any Category"){ /*If the user selected certain category, and not any category,
                                                    we add the category number to the url*/
            categoryNumberForUrl = categoryNameToCategoryNumber(categoryToDisplay, listOfAllCategories);/*Using the
                                                                                        function we created above*/
            generatedURL += `&category=${categoryNumberForUrl}`;
        }

        if(difficultyToDisplay !== "Any Difficulty"){ //The same idea as above
            difficultyNameForUrl = difficultyToDisplay.toLowerCase();/*Using toLowerCase function to fit it to the
                                                                       foramt of the url*/
            generatedURL += `&difficulty=${difficultyNameForUrl}`;
        }
        if(typeToDisplay !== "Any Type"){ //The same idea as above
            if(typeToDisplay === "Multiple Choice"){
                typeNameForUrl = "multiple";
            }
            else{
                typeNameForUrl = "boolean";
            }
            generatedURL += `&type=${typeNameForUrl}`;
        }

        generatedURL += `&encode=base64`; //We will get the questions in base64. Easier to convert it to utf-8
        try{
            result = (await axios.get(generatedURL)).data; /*Making an asynchronous HTTP GET request using Axios
            to the URL specified by generatedURL, waiting for the request to complete, and then storing the
            response data in the result variable for further processing.*/
            questionsArray = []; //Assigning empty array to the questionsArray we declared above
            for(let i = 0; i < result.results.length; i++){
                questionsArray.push(Buffer.from(result.results[i].question,'base64').toString('utf-8'));
            }/*Adding every question from the result encoded to utf-8 in the same order*/

            optionsArray = []; //Assigning empty array to optionsArray we declared above
            for(let i = 0; i < result.results.length; i++){
                optionsArray.push(result.results[i].incorrect_answers);
                let correctAnswer = result.results[i].correct_answer;
                optionsArray[i].push(correctAnswer);
            } /*Adding the incorrect answer and correct answer to the array in the same order of the questions.
                Every element in this array, is an array of options*/

            for(let i = 0; i < optionsArray.length; i++){
                for(let j = 0; j < optionsArray[i].length; j++){
                    optionsArray[i][j] = Buffer.from(optionsArray[i][j], 'base64').toString("utf-8");
                }
            } //Change the encoding from base64 to utf-8

            for(let i = 0; i < optionsArray.length; i++){
                let typeOfQuestion = Buffer.from(result.results[i].type, 'base64').toString('utf-8');
                if(typeOfQuestion === "multiple"){ //Shuffle the options in case it's multiple questions
                    shuffleOptions(optionsArray[i]);
                }
                else{ //Reordering the options in case it's True/False question
                    orderBoolean(optionsArray[i]);
                }
            }

            res.render(__dirname + "/views/index.ejs", {numberToDisplay, categoryToDisplay, difficultyToDisplay,
                typeToDisplay, questionsArray, optionsArray});
        } catch (error) {
            res.render(__dirname + "/views/index.ejs");
            console.log(error.response.data);
        }
    }

    else if(req.body.button === "Submit"){ //If the user clicked the submit button
        var playerAnswersArray = []; //Declare and assign empty array
        for(let i = 0; i < result.results.length; i++){
            let questionNumber = `q${i+1}`;
            playerAnswersArray.push(req.body[questionNumber]); // Using the name of each radio button we numbered
        } // Adding the options the user selected to the array, in the same order of questions

        var numOfCorrectAnswers = 0; // Declare and assign a counter of correct answers
        var numOfQuestionsWithCorrectAnswers = []; /*Array in which we know the number of question the answer
                                                     was correct/incorrect. In the order of the questions*/
        var correctAnswersArray = []; // Array of correct answers in the order of the questions

        for(let i = 0; i < result.results.length; i++){ /* Checking which answers are correct from what the user
                                                           selcected*/
            let correctAnswer = Buffer.from(result.results[i].correct_answer,'base64').toString('utf-8');
            // Assign the correct answer from the repository and encode it to utf-8.

            if(playerAnswersArray[i] === correctAnswer){ // If this user's answer was correct
                numOfCorrectAnswers++;
                numOfQuestionsWithCorrectAnswers.push(true);
            }
            else{
                numOfQuestionsWithCorrectAnswers.push(false);
            }
            correctAnswersArray.push(correctAnswer); // Update the correctAnswersArray
        }

        for(let i = 0; i < questionsArray.length; i++){ /* Iterating throughout the question's array*/
            if(numOfQuestionsWithCorrectAnswers[i] === false){ /* If the answer is false, We add relevant caption  to
                                                                  the question*/
                questionsArray[i] += ` WRONG ANSWER! The correct answer is ${correctAnswersArray[i]}`;
            } else { 
                questionsArray[i] += ` CORRECT ANSWER!`;
            }
        }
        res.render(__dirname + "/views/index.ejs", {questionsArray, optionsArray, playerAnswersArray, numOfCorrectAnswers});
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});