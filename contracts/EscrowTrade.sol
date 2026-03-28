// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EscrowTrade
 * @dev A basic escrow contract for P2P trades.
 * User A (buyer) locks an asset (ETH/Tokens).
 * User B (seller) can claim it only after User A marks "Service Received".
 */
contract EscrowTrade {
    enum TradeState { Created, Locked, Completed, Refunded }

    struct Trade {
        address buyer;
        address seller;
        uint256 amount;
        TradeState state;
        bool serviceReceived;
    }

    mapping(uint256 => Trade) public trades;
    uint256 public tradeCounter;

    event TradeCreated(uint256 indexed tradeId, address indexed buyer, address indexed seller, uint256 amount);
    event AssetLocked(uint256 indexed tradeId);
    event ServiceReceived(uint256 indexed tradeId);
    event TradeCompleted(uint256 indexed tradeId, address indexed seller);
    event TradeRefunded(uint256 indexed tradeId, address indexed buyer);

    modifier onlyBuyer(uint256 _tradeId) {
        require(msg.sender == trades[_tradeId].buyer, "Only the buyer can perform this action");
        _;
    }

    modifier onlySeller(uint256 _tradeId) {
        require(msg.sender == trades[_tradeId].seller, "Only the seller can perform this action");
        _;
    }

    modifier inState(uint256 _tradeId, TradeState _state) {
        require(trades[_tradeId].state == _state, "Invalid trade state for this action");
        _;
    }

    /**
     * @dev Creates a new trade and locks the asset (ETH in this basic example).
     * @param _seller The address of the seller (User B).
     */
    function createTrade(address _seller) external payable {
        require(msg.value > 0, "Amount must be greater than 0");
        require(_seller != address(0), "Invalid seller address");
        require(_seller != msg.sender, "Buyer and seller cannot be the same");

        uint256 tradeId = tradeCounter++;
        
        trades[tradeId] = Trade({
            buyer: msg.sender,
            seller: _seller,
            amount: msg.value,
            state: TradeState.Locked,
            serviceReceived: false
        });

        emit TradeCreated(tradeId, msg.sender, _seller, msg.value);
        emit AssetLocked(tradeId);
    }

    /**
     * @dev Buyer marks the service as received.
     * @param _tradeId The ID of the trade.
     */
    function markServiceReceived(uint256 _tradeId) external onlyBuyer(_tradeId) inState(_tradeId, TradeState.Locked) {
        trades[_tradeId].serviceReceived = true;
        emit ServiceReceived(_tradeId);
    }

    /**
     * @dev Seller claims the locked asset after the buyer has marked the service as received.
     * @param _tradeId The ID of the trade.
     */
    function claimAsset(uint256 _tradeId) external onlySeller(_tradeId) inState(_tradeId, TradeState.Locked) {
        Trade storage trade = trades[_tradeId];
        require(trade.serviceReceived, "Service not yet marked as received by the buyer");

        trade.state = TradeState.Completed;
        
        (bool success, ) = trade.seller.call{value: trade.amount}("");
        require(success, "Transfer failed");

        emit TradeCompleted(_tradeId, trade.seller);
    }

    /**
     * @dev Allows the seller to refund the buyer if they cannot fulfill the service.
     * @param _tradeId The ID of the trade.
     */
    function refundBuyer(uint256 _tradeId) external onlySeller(_tradeId) inState(_tradeId, TradeState.Locked) {
        Trade storage trade = trades[_tradeId];
        trade.state = TradeState.Refunded;

        (bool success, ) = trade.buyer.call{value: trade.amount}("");
        require(success, "Refund failed");

        emit TradeRefunded(_tradeId, trade.buyer);
    }
}
