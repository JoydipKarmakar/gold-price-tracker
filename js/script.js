document.addEventListener('DOMContentLoaded', () => {
    // --- Current Price Display Logic (Same as before) ---
    const apiKey = 'cfd732b95e01ccfab801b0322c8fcbc3'; // Your API Key
    const baseUrl = 'https://api.metalpriceapi.com/v1/latest';
    const baseCurrency = 'INR';
    const targetCurrencies = 'EUR,XAU,XAG,USD,INR';

    const priceContainer = document.getElementById('price-container');
    const lastUpdatedElement = document.getElementById('last-updated');
    const errorElement = document.getElementById('error-message');

    async function fetchCurrentPrices() {
        priceContainer.innerHTML = '<p>Loading current prices...</p>';
        errorElement.textContent = '';
        lastUpdatedElement.textContent = 'Last updated: --';

        const apiUrl = `${baseUrl}?api_key=${apiKey}&base=${baseCurrency}&currencies=${targetCurrencies}`;

        try {
            const response = await fetch(apiUrl);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status} - ${errorData.error ? errorData.error.message : response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                const rates = data.rates;
                let pricesHtml = '';

                // Display Gold (XAU) price in INR (1 XAU = X INR)
                if (rates.XAU) {
                    const xauPriceInInr = (1 / rates.XAU).toFixed(2);
                    pricesHtml += `
                        <div class="price-item">
                            <span class="price-label">Gold (XAU):</span>
                            <span class="price-value">${xauPriceInInr} INR</span>
                        </div>
                    `;
                }

                 // Display Silver (XAG) price in INR (1 XAG = X INR)
                 if (rates.XAG) {
                    const xagPriceInInr = (1 / rates.XAG).toFixed(2);
                    pricesHtml += `
                        <div class="price-item">
                            <span class="price-label">Silver (XAG):</span>
                            <span class="price-value">${xagPriceInInr} INR</span>
                        </div>
                    `;
                }

                // Display other currency rates relative to INR (1 TARGET = X INR)
                const otherCurrencies = ['EUR', 'USD'];
                otherCurrencies.forEach(currency => {
                    if (rates[currency]) {
                        const priceInInr = (1 / rates[currency]).toFixed(2);
                         pricesHtml += `
                            <div class="price-item">
                                <span class="price-label">1 ${currency}:</span>
                                <span class="price-value">${priceInInr} INR</span>
                            </div>
                        `;
                    }
                });

                priceContainer.innerHTML = pricesHtml;

                if (data.timestamp) {
                    const date = new Date(data.timestamp * 1000);
                    lastUpdatedElement.textContent = `Last updated: ${date.toLocaleString()}`;
                }

            } else {
                const errorMessage = data.error && data.error.message ? data.error.message : 'An unknown API error occurred.';
                errorElement.textContent = `Error fetching current prices: ${errorMessage}`;
                priceContainer.innerHTML = '<p>Could not load current prices.</p>';
            }

        } catch (error) {
            console.error('Error fetching current prices:', error);
            errorElement.textContent = `Failed to fetch current prices. Please try again later. (${error.message})`;
            priceContainer.innerHTML = '<p>Could not load current prices.</p>';
        }
    }

    // --- Historical Data and Graphing Logic ---

    const chartCanvas = document.getElementById('priceChart');
    let priceChart = null; // To hold the Chart.js instance

    async function fetchHistoricalPrices() {
        const csvFilePath = 'data/historical_prices.csv'; // Path to your CSV file

        try {
            const response = await fetch(csvFilePath);

            if (!response.ok) {
                 if (response.status === 404) {
                     console.warn(`Historical data file not found at ${csvFilePath}. Skipping graph.`);
                     chartCanvas.parentElement.innerHTML = '<p>Historical data file not found or not accessible.</p>';
                     return;
                 }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const csvText = await response.text();
            const dataPoints = parseCSV(csvText); // Use the updated CSV parser

            if (dataPoints.length < 2) {
                 chartCanvas.parentElement.innerHTML = '<p>Historical data is empty or incorrectly formatted.</p>';
                 console.error("CSV data is empty or has no header row.");
                 return;
            }

            // Assuming the CSV structure is Date,Open,High,Low,Close,Volume,Change
            // We need Date (index 0) and Close (index 4)
            const headerRow = dataPoints[0];
            const dateColumnIndex = 0; // Date is the first column
            const closePriceColumnIndex = 4; // Close price is the fifth column (index 4)

             // Basic check if columns exist (optional but good practice)
             if (headerRow.length <= dateColumnIndex || headerRow.length <= closePriceColumnIndex) {
                 chartCanvas.parentElement.innerHTML = '<p>CSV file does not have enough columns for Date and Close price.</p>';
                 console.error("CSV file structure is unexpected.");
                 return;
             }


            // Prepare data for Chart.js
            const chartData = dataPoints.slice(1) // Skip header row
                .map(row => {
                    // Ensure row has enough columns
                    if (row.length > closePriceColumnIndex) {
                        const dateString = row[dateColumnIndex].trim();
                        const priceString = row[closePriceColumnIndex].trim();

                        // Clean price string by removing commas before parsing
                        const cleanedPriceString = priceString.replace(/,/g, '');
                        const price = parseFloat(cleanedPriceString);

                        // Parse date string (Chart.js time adapter can handle "MMM d, yyyy")
                        const date = new Date(dateString);

                        // Only include rows with valid date and price
                        if (!isNaN(date.getTime()) && !isNaN(price)) {
                            return { x: date, y: price };
                        } else {
                             console.warn(`Skipping invalid row: ${row.join(',')}`);
                        }
                    } else {
                         console.warn(`Skipping row with insufficient columns: ${row.join(',')}`);
                    }
                    return null; // Filter out invalid rows
                })
                .filter(point => point !== null); // Remove null entries

            if (chartData.length === 0) {
                 chartCanvas.parentElement.innerHTML = '<p>No valid historical data found for graphing after parsing.</p>';
                 console.warn("No valid data points found after parsing CSV.");
                 return;
            }

            // Sort data by date (the provided data is reverse chronological, Chart.js needs it chronological)
            chartData.sort((a, b) => a.x - b.x);

            // Destroy existing chart if it exists
            if (priceChart) {
                priceChart.destroy();
            }

            // Create the chart with improved styling
            priceChart = new Chart(chartCanvas, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'USD/Gold Price History',
                        data: chartData,
                        borderColor: '#d4af37', /* Gold line color */
                        backgroundColor: 'rgba(212, 175, 55, 0.2)', /* Semi-transparent gold fill below line */
                        fill: true, // Fill area below the line
                        tension: 0.2, // Slightly more tension for smoother curve
                        pointRadius: 0, // Hide data points
                        hoverRadius: 5, // Show point on hover
                        borderWidth: 2 // Thicker line
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false, // Allow chart-container to control size
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'month', // Adjust unit based on data range
                                tooltipFormat: 'MMM d, yyyy' // Format tooltip date
                            },
                            title: {
                                display: true,
                                text: 'Date',
                                color: '#495057'
                            },
                            ticks: {
                                color: '#6c757d'
                            },
                            grid: {
                                color: '#e9ecef' // Light grid lines
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Price (USD)',
                                color: '#495057'
                            },
                            ticks: {
                                color: '#6c757d'
                            },
                             grid: {
                                color: '#e9ecef'
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    const date = new Date(context[0].parsed.x);
                                    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); // More readable date format
                                },
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y.toFixed(2) + ' USD'; // Format price
                                    return label;
                                }
                            }
                        },
                        legend: {
                            display: true,
                            labels: {
                                color: '#495057' // Legend text color
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('Error fetching or processing historical prices:', error);
            chartCanvas.parentElement.innerHTML = `<p class="error">Failed to load historical data: ${error.message}</p>`;
        }
    }

    // Simple CSV parser (handles basic comma separation and quotes)
    // Updated to handle potential extra spaces and commas within numbers
    function parseCSV(text) {
        const rows = text.split('\n').filter(row => row.trim() !== ''); // Split into rows, remove empty lines
        return rows.map(row => {
            // Simple split by comma, doesn't handle commas within quoted fields robustly
            // For this specific data format, splitting by tab or multiple spaces might be better
            // Let's try splitting by multiple spaces or tabs first, then fallback to comma if needed
            let cells = row.split(/\s{2,}|\t|,/).map(cell => cell.trim()).filter(cell => cell !== ''); // Split by 2+ spaces, tab, or comma, trim, remove empty cells

            // If splitting by spaces/tabs didn't work well (e.g., only one cell), try splitting just by comma
            if (cells.length < 2) {
                 cells = row.split(',').map(cell => cell.trim());
            }

            return cells;
        });
    }


    // Fetch current prices when the page loads
    fetchCurrentPrices();

    // Fetch and display historical chart when the page loads
    fetchHistoricalPrices();

    // Optional: Refresh current prices periodically (e.g., every 5 minutes)
    // setInterval(fetchCurrentPrices, 300000); // 300000 milliseconds = 5 minutes
});
