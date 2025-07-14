// --- CONFIGURATION ---
// IMPORTANT: Replace with your Firebase project configuration


  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyB4DevDcHfyEcwP4ZoEZxYHhCzFTgbigPU",
    authDomain: "bella-sports-awards.firebaseapp.com",
    projectId: "bella-sports-awards",
    storageBucket: "bella-sports-awards.firebasestorage.app",
    messagingSenderId: "36360687628",
    appId: "1:36360687628:web:c926db17a16b411598de29",
    measurementId: "G-SJ7KFHYGX4"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);


// --- SETTINGS ---
// Set this to false during the last few days of voting to turn off live updates
const LIVE_UPDATES_ENABLED = true;

// Set the voting end date (YYYY-MM-DDTHH:MM:SS)
const VOTING_END_DATE = new Date("2024-12-31T23:59:59");

// --- INITIALIZATION ---
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const nomineesCollection = db.collection('nominees');

// --- DOM ELEMENTS ---
const nomineesGrid = document.getElementById('nominees-grid');
const countdownElement = document.getElementById('timer');

// --- STATE ---
let localVotes = {}; // To store vote counts locally
let totalVotes = 0;
let hasVoted = localStorage.getItem('hasVoted');

// --- FUNCTIONS ---

/**
 * Renders the nominee cards on the page
 * @param {Array} nominees - Array of nominee objects from Firestore
 */
function renderNominees(nominees) {
    nomineesGrid.innerHTML = ''; // Clear loading spinner
    totalVotes = nominees.reduce((sum, nom) => sum + nom.votes, 0);

    nominees.forEach(nominee => {
        const percentage = totalVotes > 0 ? ((nominee.votes / totalVotes) * 100).toFixed(1) : 0;
        
        const card = document.createElement('div');
        card.className = 'nominee-card';
        card.innerHTML = `
            <img src="${nominee.imageUrl}" alt="${nominee.name}" class="nominee-image">
            <div class="nominee-info">
                <h3 class="nominee-name">${nominee.name}</h3>
                <div class="progress-bar">
                    <div class="progress-bar-fill" id="progress-${nominee.id}" style="width: ${percentage}%">${percentage}%</div>
                </div>
                <p class="vote-count" id="count-${nominee.id}">${nominee.votes.toLocaleString()} Votes</p>
                <button class="vote-button" data-id="${nominee.id}" ${hasVoted ? 'disabled' : ''}>
                    ${hasVoted ? 'Voted' : 'Vote'}
                </button>
            </div>
        `;
        nomineesGrid.appendChild(card);
    });

    if (hasVoted) {
        disableAllVoteButtons();
    }
}

/**
 * Updates the UI with new vote counts
 * @param {Array} nominees - Array of nominee objects from Firestore
 */
function updateVoteDisplay(nominees) {
    totalVotes = nominees.reduce((sum, nom) => sum + nom.votes, 0);

    nominees.forEach(nominee => {
        const percentage = totalVotes > 0 ? ((nominee.votes / totalVotes) * 100).toFixed(1) : 0;
        
        const progressBarFill = document.getElementById(`progress-${nominee.id}`);
        const voteCountText = document.getElementById(`count-${nominee.id}`);

        if (progressBarFill && voteCountText) {
            progressBarFill.style.width = `${percentage}%`;
            progressBarFill.textContent = `${percentage}%`;
            voteCountText.textContent = `${nominee.votes.toLocaleString()} Votes`;
        }
    });
}

/**
 * Fetches initial data or listens for live updates
 */
function initializeVotingData() {
    if (LIVE_UPDATES_ENABLED) {
        // Real-time listener
        nomineesCollection.onSnapshot(snapshot => {
            const nominees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            nominees.sort((a, b) => b.votes - a.votes); // Sort by votes
            
            // First time render or update display
            if (nomineesGrid.querySelector('.loading-spinner')) {
                renderNominees(nominees);
            } else {
                updateVoteDisplay(nominees);
            }
        }, error => {
            console.error("Error fetching real-time data: ", error);
            nomineesGrid.innerHTML = '<p>Could not load voting data. Please try again later.</p>';
        });
    } else {
        // Fetch data only once
        nomineesCollection.get().then(snapshot => {
            const nominees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            nominees.sort((a, b) => b.votes - a.votes);
            renderNominees(nominees);
        }).catch(error => {
            console.error("Error fetching one-time data: ", error);
            nomineesGrid.innerHTML = '<p>Could not load voting data. Please try again later.</p>';
        });
    }
}

/**
 * Handles the vote button click event
 * @param {Event} e - The click event
 */
async function handleVote(e) {
    if (!e.target.matches('.vote-button')) return;

    if (hasVoted) {
        alert("You have already cast your vote.");
        return;
    }

    const nomineeId = e.target.dataset.id;
    const voteButton = e.target;
    
    voteButton.disabled = true;
    voteButton.textContent = 'Casting...';

    try {
        const response = await fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nomineeId: nomineeId })
        });
        
        const result = await response.json();

        if (response.ok) {
            // Success!
            localStorage.setItem('hasVoted', 'true');
            hasVoted = true;
            disableAllVoteButtons();
            alert('Thank you for voting!');
            
            // If live updates are off, manually update the voted item for instant feedback
            if (!LIVE_UPDATES_ENABLED) {
                 const voteCountText = document.getElementById(`count-${nomineeId}`);
                 let currentVotes = parseInt(voteCountText.textContent.replace(/,/g, '').split(' ')[0]);
                 voteCountText.textContent = `${(currentVotes + 1).toLocaleString()} Votes`;
            }

        } else {
            throw new Error(result.message || 'Voting failed');
        }

    } catch (error) {
        console.error('Voting error:', error);
        alert(`Error: ${error.message}. Please try again.`);
        voteButton.disabled = false;
        voteButton.textContent = 'Vote';
    }
}

function disableAllVoteButtons() {
    document.querySelectorAll('.vote-button').forEach(button => {
        button.disabled = true;
        button.textContent = 'Voted';
        button.classList.add('disabled');
    });
}

/**
 * Manages the countdown timer
 */
function updateCountdown() {
    const now = new Date();
    const distance = VOTING_END_DATE - now;

    if (distance < 0) {
        clearInterval(timerInterval);
        countdownElement.innerHTML = "Voting has ended!";
        disableAllVoteButtons();
        return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    countdownElement.innerHTML = `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    initializeVotingData();
    updateCountdown();
    const timerInterval = setInterval(updateCountdown, 1000);
    nomineesGrid.addEventListener('click', handleVote);
});

// Basic share functionality
document.getElementById('share-button').addEventListener('click', () => {
    if (navigator.share) {
        navigator.share({
            title: 'Vote in the Bella Sports Creator Awards!',
            text: 'Help your favorite sports creator win. Cast your vote now!',
            url: window.location.href,
        }).catch(console.error);
    } else {
        alert('Share this page by copying the URL from your browser!');
    }
});