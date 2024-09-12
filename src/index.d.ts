declare module "neural-crypto-bot" {
    import NeuralNetworkClass from "./NeuralNetworkClass";
    import { LearningDataInterface, TrainingDataInterface, OutputTrainingDataInterface, CandleDataInterface, CandleInterface, PositionType, MarketOptions, LimitOptions } from "./Interfaces";

    export { NeuralNetworkClass, LearningDataInterface, TrainingDataInterface, OutputTrainingDataInterface, CandleDataInterface, CandleInterface, PositionType, MarketOptions, LimitOptions };
}