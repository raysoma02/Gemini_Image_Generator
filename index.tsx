/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality, type GenerateContentResponse } from "@google/genai";

// --- DOM Elements ---
const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const dropZone = document.querySelector('.drop-zone') as HTMLLabelElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const dropZonePrompt = document.getElementById('drop-zone-prompt') as HTMLDivElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const editButton = document.getElementById('edit-button') as HTMLButtonElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const loaderMessage = document.getElementById('loader-message') as HTMLParagraphElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;
const editedImage = document.getElementById('edited-image') as HTMLImageElement;
const editedCaption = document.getElementById('edited-caption') as HTMLParagraphElement;


// --- App State ---
let uploadedImage: { mimeType: string; data: string; } | null = null;

// --- Gemini AI Client ---
// API Key is sourced from the environment variable `process.env.API_KEY`
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const imageEditingModel = 'gemini-2.5-flash-image-preview';

const loadingMessages = [
    "Gemini is working its magic...",
    "Analyzing your image...",
    "Getting creative with your prompt...",
    "This might take a moment...",
    "Generating new pixels...",
    "Almost there...",
];
let messageInterval: number;


// --- UI Functions ---

function showLoader(show: boolean) {
    if (show) {
        loader.style.display = 'flex';
        editedImage.style.display = 'none';
        editedCaption.style.display = 'none';
        errorContainer.style.display = 'none';
        let i = 0;
        loaderMessage.textContent = loadingMessages[i];
        messageInterval = window.setInterval(() => {
            i = (i + 1) % loadingMessages.length;
            loaderMessage.textContent = loadingMessages[i];
        }, 2000);
    } else {
        loader.style.display = 'none';
        clearInterval(messageInterval);
    }
}

function showError(message: string) {
    showLoader(false);
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
}

function updateButtonState() {
    const promptText = promptInput.value.trim();
    editButton.disabled = !uploadedImage || !promptText;
}

function handleImageUpload(file: File) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG, JPG, WEBP).');
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        uploadedImage = {
            mimeType: file.type,
            data: base64Data,
        };
        imagePreview.src = `data:${file.type};base64,${base64Data}`;
        dropZone.classList.add('has-image');
        updateButtonState();
    };
    reader.onerror = () => {
        alert('Error reading the file.');
    };
    reader.readAsDataURL(file);
}

// --- Gemini API Call ---

async function runImageEditing() {
    if (!uploadedImage || !promptInput.value.trim()) {
        showError('Please upload an image and provide an editing prompt.');
        return;
    }

    showLoader(true);
    editButton.disabled = true;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: imageEditingModel,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: uploadedImage.data,
                            mimeType: uploadedImage.mimeType,
                        },
                    },
                    { text: promptInput.value.trim() },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        showLoader(false);

        let imageFound = false;
        let textFound = '';

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                editedImage.src = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
                editedImage.style.display = 'block';
                imageFound = true;
            } else if (part.text) {
                textFound += part.text;
            }
        }

        if (!imageFound) {
            showError('The model did not return an image. Please try a different prompt.');
        }

        if (textFound) {
            editedCaption.textContent = textFound;
            editedCaption.style.display = 'block';
        } else {
            editedCaption.style.display = 'none';
        }

    } catch (e) {
        const error = e as Error;
        console.error(error);
        showError(`An error occurred: ${error.message}`);
    } finally {
        updateButtonState();
    }
}


// --- Event Listeners ---

imageUpload.addEventListener('change', () => {
    if (imageUpload.files && imageUpload.files.length > 0) {
        handleImageUpload(imageUpload.files[0]);
    }
});

promptInput.addEventListener('input', updateButtonState);
editButton.addEventListener('click', runImageEditing);

// Drag and drop listeners
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragging');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragging');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragging');
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleImageUpload(e.dataTransfer.files[0]);
        // To allow re-dropping the same file
        imageUpload.value = '';
    }
});

// Pre-fill the prompt from the user request
promptInput.value = "Change dress to shiffon saree, more like 1970s vibe. Change the background to a dance hall.";
updateButtonState();

export { };
