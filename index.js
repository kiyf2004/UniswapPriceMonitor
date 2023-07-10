const Web3 = require('web3');
const Big = require("big.js");

const UniswapV3PairABI = require("./abi/IUniswapV3Pair.json");
const UniswapV2Pair = require("./abi/IUniswapV2Pair.json");

// State for V2 reserves
const state = {
    blockNumber: undefined,
    token0: undefined,
    token1: undefined,
};

// function to get reserves for V2 pair
const getReserves = async (pairContract) => {
    const _reserves = await pairContract.methods.getReserves().call();
    return [Big(_reserves.reserve0), Big(_reserves.reserve1)];
};

const updateState = (data) => {
    state.token0 = Big(data.returnValues.reserve0);
    state.token1 = Big(data.returnValues.reserve1);
    state.blockNumber = data.blockNumber;
    console.log(
        `${state.blockNumber} Price: ${state.token0
            .div(state.token1)
            .toString()}`
    );
};

const mainFunction = async (version, address, apiKey) => {
    let provider = new Web3.providers.WebsocketProvider(
        `wss://mainnet.infura.io/ws/v3/${apiKey}`
    );

    const web3 = new Web3(provider);

    let pairContract;
    let abi;

    if (version === "v2") {
        abi = UniswapV2Pair.abi;
    } else if (version === "v3") {
        abi = UniswapV3PairABI;
    } else {
        console.error("Unsupported Uniswap version");
        return;
    }

    pairContract = new web3.eth.Contract(abi, address);

    // For V3 version
    if (version === "v3") {
        const slot0 = await pairContract.methods.slot0().call();
        const currentTick = Number(slot0.tick);
        const price = Math.pow(1.0001, currentTick);
        console.log(`Price: ${price}`);

        pairContract.events.Swap()
            .on('data', (event) => {
                const blockNumber = event.blockNumber;
                const tick = Number(event.returnValues.tick);
                const price = Math.pow(1.0001, tick);
                console.log(`Price: ${price}`);
            })
            .on('error', (error) => {
                console.error(error);
                if (error.code === 'ECONNRESET') {
                    console.log('Connection lost. Reconnecting...');
                    provider = new Web3.providers.WebsocketProvider(
                        `wss://mainnet.infura.io/ws/v3/${apiKey}`
                    );
                    web3.setProvider(provider);
                }
            });
    } 
    // For V2 version
    else if (version === "v2") {
        [state.token0, state.token1] = await getReserves(pairContract);
        state.blockNumber = await web3.eth.getBlockNumber();
        pairContract.events.Sync({}).on("data", (data) => updateState(data));
        console.log(
            `Price: ${state.token0
                .div(state.token1)
                .toString()}`
        );
    }
};

mainFunction("v3", "0x4585FE77225b41b697C938B018E2Ac67Ac5a20c0", "6decd2494d714b53b201a9642db5f1f8"); // V3 BTC/ETH pair
mainFunction('v2','0xa478c2975ab1ea89e8196811f51a7b7ade33eb11','6decd2494d714b53b201a9642db5f1f8');// V2 DAI/ETH Pair
