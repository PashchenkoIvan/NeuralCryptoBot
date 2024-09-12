"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const synaptic_1 = require("synaptic");
const cliProgress = __importStar(require("cli-progress"));
const date_fns_1 = require("date-fns");
class NeuralNetworkClass {
    constructor(Binance, filePath, inputLayerSize, hiddenLayersSizes, outputLayerSize, brainDataFilePath) {
        this.client = Binance;
        this.inputLayer = new synaptic_1.Layer(inputLayerSize);
        this.hiddenLayers = hiddenLayersSizes.map(size => new synaptic_1.Layer(size));
        this.outputLayer = new synaptic_1.Layer(outputLayerSize);
        // Connect layers
        this.inputLayer.project(this.hiddenLayers[0]);
        for (let i = 0; i < this.hiddenLayers.length - 1; i++) {
            this.hiddenLayers[i].project(this.hiddenLayers[i + 1]);
        }
        this.hiddenLayers[this.hiddenLayers.length - 1].project(this.outputLayer);
        // Create network
        this.network = new synaptic_1.Network({
            input: this.inputLayer,
            hidden: this.hiddenLayers,
            output: this.outputLayer
        });
        // Create trainer
        this.trainer = new synaptic_1.Trainer(this.network);
        // Load learning data
        try {
            this.learningData = this.loadLearningData(filePath);
        }
        catch (error) {
            console.error(`Failed to load learning data: ${error.message}`);
            this.learningData = [];
        }
        // Set brain file path
        this.brainFile = brainDataFilePath;
    }
    loadLearningData(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, JSON.stringify([]));
                console.log(`File not found. Created new file at ${filePath}`);
                return [];
            }
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(fileContent);
        }
        catch (error) {
            console.error(`Error reading file ${filePath}: ${error.message}`);
            return [];
        }
    }
    trainNetwork(learningRate, iterations) {
        const trainingSet = this.learningData.map(data => ({
            input: this.flattenInput(data.input),
            output: this.flattenOutput(data.output)
        }));
        // Create progress bar
        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(iterations, 0);
        this.trainer.train(trainingSet, {
            rate: learningRate,
            iterations: iterations,
            error: 0.005,
            shuffle: true,
            log: 100,
            cost: synaptic_1.Trainer.cost.CROSS_ENTROPY,
            schedule: {
                every: 1,
                do: (data) => {
                    progressBar.update(data.iterations);
                }
            }
        });
        progressBar.stop();
        console.log('Training completed');
        // Save the trained network
        this.saveNetwork();
    }
    flattenInput(input) {
        return input.candles.flatMap(candle => [
            candle.candle.open,
            candle.candle.high,
            candle.candle.low,
            candle.candle.close,
            candle.sma_short,
            candle.sma_long,
            candle.rsi,
            candle.btc_correlation
        ]);
    }
    flattenOutput(output) {
        return [
            output.positionType === "LONG" ? 1 : 0,
            output.positionType === "SHORT" ? 1 : 0,
            output.positionType === "NO" ? 1 : 0,
            output.takeProfitPrice,
            output.stopLossPrice
        ];
    }
    unflattenOutput(output) {
        const positionType = output[0] === 1 ? "LONG" : output[1] === 1 ? "SHORT" : "NO";
        return {
            positionType: positionType,
            takeProfitPrice: output[3],
            stopLossPrice: output[4]
        };
    }
    predict(inputData) {
        const input = this.flattenInput(inputData);
        const output = this.network.activate(input);
        return this.unflattenOutput(output);
    }
    saveNetwork() {
        const networkState = this.network.toJSON();
        fs.writeFileSync(this.brainFile, JSON.stringify(networkState));
        console.log(`Network state saved to ${this.brainFile}`);
    }
    loadNetwork() {
        if (!fs.existsSync(this.brainFile)) {
            console.log(`Brain file not found at ${this.brainFile}`);
            return;
        }
        const networkState = JSON.parse(fs.readFileSync(this.brainFile, 'utf-8'));
        this.network = synaptic_1.Network.fromJSON(networkState); // Correctly using the static method
        console.log(`Network state loaded from ${this.brainFile}`);
    }
    async fetchCandles(symbol, interval, limit, endTime) {
        const candles = await this.client.futuresCandles({
            symbol: symbol,
            interval: interval,
            limit: limit,
            endTime: endTime
        });
        return candles.map(candle => ({
            openTime: candle.openTime,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseFloat(candle.volume),
            closeTime: candle.closeTime,
            quoteVolume: parseFloat(candle.quoteVolume),
            trades: candle.trades,
            baseAssetVolume: parseFloat(candle.baseAssetVolume),
            quoteAssetVolume: parseFloat(candle.quoteAssetVolume),
        }));
    }
    calculateSMA(candles, period) {
        let sma = [];
        for (let i = 0; i < candles.length; i++) {
            if (i < period - 1) {
                sma.push(0);
            }
            else {
                let sum = 0;
                for (let j = 0; j < period; j++) {
                    sum += candles[i - j].close;
                }
                sma.push(sum / period);
            }
        }
        return sma;
    }
    calculateRSI(candles, period) {
        let rsi = [];
        let gains = 0;
        let losses = 0;
        for (let i = 1; i < candles.length; i++) {
            let change = candles[i].close - candles[i - 1].close;
            if (change > 0) {
                gains += change;
            }
            else {
                losses -= change;
            }
            if (i >= period) {
                let avgGain = gains / period;
                let avgLoss = losses / period;
                let rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
                let prevChange = candles[i - period + 1].close - candles[i - period].close;
                if (prevChange > 0) {
                    gains -= prevChange;
                }
                else {
                    losses += prevChange;
                }
            }
            else {
                rsi.push(0);
            }
        }
        return rsi;
    }
    calculateCorrelation(candles, btcCandles) {
        let correlation = [];
        for (let i = 0; i < candles.length; i++) {
            if (i < btcCandles.length) {
                let cov = 0;
                let varA = 0;
                let varB = 0;
                let meanA = candles.slice(0, i + 1).reduce((sum, candle) => sum + candle.close, 0) / (i + 1);
                let meanB = btcCandles.slice(0, i + 1).reduce((sum, candle) => sum + candle.close, 0) / (i + 1);
                for (let j = 0; j <= i; j++) {
                    cov += (candles[j].close - meanA) * (btcCandles[j].close - meanB);
                    varA += Math.pow(candles[j].close - meanA, 2);
                    varB += Math.pow(btcCandles[j].close - meanB, 2);
                }
                correlation.push(cov / Math.sqrt(varA * varB));
            }
            else {
                correlation.push(0);
            }
        }
        return correlation;
    }
    calculateIndicators(candles, btcCandles) {
        const smaShort = this.calculateSMA(candles, 50);
        const smaLong = this.calculateSMA(candles, 200);
        const rsi = this.calculateRSI(candles, 14);
        const btcCorrelation = this.calculateCorrelation(candles, btcCandles);
        return candles.map((candle, index) => ({
            candle,
            sma_short: smaShort[index],
            sma_long: smaLong[index],
            rsi: rsi[index],
            btc_correlation: btcCorrelation[index],
        }));
    }
    parseDateTime(dateTime) {
        return (0, date_fns_1.parse)(dateTime, 'yyyy-MM-dd HH:mm:ss', new Date()).getTime();
    }
    async addMarketTrainingData(filePath, option) {
        const endTime = this.parseDateTime(option.endTime);
        const candles = await this.fetchCandles(option.symbol, option.interval, option.limit, endTime);
        const btcCandles = await this.fetchCandles("BTCUSDT", option.interval, option.limit, endTime);
        const candleData = this.calculateIndicators(candles, btcCandles);
        const trainingData = {
            input: {
                symbol: option.symbol,
                interval: option.interval,
                candles: candleData
            },
            output: {
                positionType: option.positionType,
                takeProfitPrice: option.takeProfitPrice,
                stopLossPrice: option.stopLossPrice,
            },
        };
        let data = [];
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        data.push(trainingData);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    async addLimitTrainingData(filePath, option) {
        const endTime = this.parseDateTime(option.endTime);
        const candles = await this.fetchCandles(option.symbol, option.interval, option.limit, endTime);
        const btcCandles = await this.fetchCandles("BTCUSDT", option.interval, option.limit, endTime);
        const candleData = this.calculateIndicators(candles, btcCandles);
        const trainingData = {
            input: {
                symbol: option.symbol,
                interval: option.interval,
                candles: candleData,
            },
            output: {
                positionType: option.positionType,
                takeProfitPrice: option.takeProfitPrice,
                stopLossPrice: option.stopLossPrice,
            },
        };
        let data = [];
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        }
        data.push(trainingData);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
}
exports.default = NeuralNetworkClass;
//# sourceMappingURL=NeuralNetworkClass.js.map