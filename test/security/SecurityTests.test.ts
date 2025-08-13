import { expect } from "chai";
import { ethers } from "hardhat";
import { CarbonNFT, Community, Marketplace, Governance } from "../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Security Tests", function () {
    let carbonNFT: CarbonNFT;
    let community: Community;
    let marketplace: Marketplace;
    let governance: Governance;
    let owner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;
    let attacker: SignerWithAddress;
    
    enum UserType { Individual, Company }
    enum Grade { F, D, C, B, A }
    
    beforeEach(async function () {
        [owner, user1, user2, attacker] = await ethers.getSigners();
        
        // Deploy contracts
        const CarbonNFTFactory = await ethers.getContractFactory("CarbonNFT");
        carbonNFT = await CarbonNFTFactory.deploy() as CarbonNFT;
        await carbonNFT.deployed();
        
        const CommunityFactory = await ethers.getContractFactory("Community");
        community = await CommunityFactory.deploy(carbonNFT.address) as Community;
        await community.deployed();
        
        const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
        marketplace = await MarketplaceFactory.deploy(carbonNFT.address) as Marketplace;
        await marketplace.deployed();
        
        const GovernanceFactory = await ethers.getContractFactory("Governance");
        governance = await GovernanceFactory.deploy(carbonNFT.address) as Governance;
        await governance.deployed();
        
        // Setup test data
        await carbonNFT.connect(user1).registerUser(UserType.Individual);
        await carbonNFT.connect(user2).registerUser(UserType.Individual);
        await carbonNFT.mintCarbonNFT(user1.address, "test-uri", "test-theme", Grade.C, 500);
    });

    describe("Access Control Tests", function () {
        it("Should prevent unauthorized minting", async function () {
            await expect(
                carbonNFT.connect(attacker).mintCarbonNFT(
                    attacker.address,
                    "malicious-uri",
                    "malicious-theme",
                    Grade.A,
                    1000
                )
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should prevent unauthorized grade updates", async function () {
            await expect(
                carbonNFT.connect(attacker).updateGrade(0, Grade.A, 1000, "new-uri")
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should prevent non-owner from setting marketplace fees", async function () {
            await expect(
                marketplace.connect(attacker).setMarketplaceFee(1000)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should prevent non-owner from updating governance parameters", async function () {
            await expect(
                governance.connect(attacker).updateQuorumPercentage(25)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Should prevent non-NFT-holders from creating proposals", async function () {
            await expect(
                governance.connect(attacker).createProposal(
                    "Malicious proposal",
                    0, // MARKETPLACE_FEE
                    ethers.utils.defaultAbiCoder.encode(["uint256"], [5000])
                )
            ).to.be.revertedWithCustomError(governance, "InsufficientVotingPower");
        });

        it("Should prevent non-NFT-holders from voting", async function () {
            // First create a proposal with a valid NFT holder
            await governance.connect(user1).createProposal(
                "Test proposal",
                0,
                ethers.utils.defaultAbiCoder.encode(["uint256"], [300])
            );

            await expect(
                governance.connect(attacker).vote(0, true)
            ).to.be.revertedWithCustomError(governance, "InsufficientVotingPower");
        });
    });

    describe("Input Validation Tests", function () {
        it("Should reject invalid grades in minting", async function () {
            await expect(
                carbonNFT.mintCarbonNFT(user1.address, "test-uri", "test-theme", 5, 500) // Grade 5 doesn't exist
            ).to.be.revertedWithCustomError(carbonNFT, "InvalidGrade");
        });

        it("Should reject invalid scores in minting", async function () {
            await expect(
                carbonNFT.mintCarbonNFT(user1.address, "test-uri", "test-theme", Grade.C, 15000) // Score too high
            ).to.be.revertedWithCustomError(carbonNFT, "InvalidScore");
        });

        it("Should reject empty token URI", async function () {
            await expect(
                carbonNFT.mintCarbonNFT(user1.address, "", "test-theme", Grade.C, 500)
            ).to.be.revertedWithCustomError(carbonNFT, "InvalidTokenURI");
        });

        it("Should reject empty theme", async function () {
            await expect(
                carbonNFT.mintCarbonNFT(user1.address, "test-uri", "", Grade.C, 500)
            ).to.be.revertedWithCustomError(carbonNFT, "InvalidTheme");
        });

        it("Should reject zero address in constructor", async function () {
            const CommunityFactory = await ethers.getContractFactory("Community");
            await expect(
                CommunityFactory.deploy(ethers.constants.AddressZero)
            ).to.be.revertedWithCustomError(community, "ZeroAddress");
        });

        it("Should reject invalid price limits in marketplace", async function () {
            // Approve marketplace to transfer NFT
            await carbonNFT.connect(user1).approve(marketplace.address, 0);
            
            // Test zero price
            await expect(
                marketplace.connect(user1).listNFT(0, 0)
            ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
            
            // Test extremely high price
            await expect(
                marketplace.connect(user1).listNFT(0, ethers.utils.parseEther("1001"))
            ).to.be.revertedWithCustomError(marketplace, "InvalidPrice");
        });

        it("Should reject invalid limits in pagination", async function () {
            await expect(
                community.getPublicNFTs(0, 0) // Zero limit
            ).to.be.revertedWithCustomError(community, "InvalidLimit");
            
            await expect(
                community.getPublicNFTs(0, 101) // Limit too high
            ).to.be.revertedWithCustomError(community, "InvalidLimit");
        });
    });

    describe("Reentrancy Protection Tests", function () {
        it("Should prevent reentrancy in NFT endorsement", async function () {
            // Create a malicious contract that tries to re-enter
            const MaliciousEndorser = await ethers.getContractFactory("MaliciousEndorser");
            const maliciousEndorser = await MaliciousEndorser.deploy(carbonNFT.address);
            await maliciousEndorser.deployed();
            
            // Register the malicious contract as a user and give it an NFT
            await carbonNFT.connect(owner).mintCarbonNFT(
                maliciousEndorser.address,
                "malicious-uri",
                "malicious-theme",
                Grade.C,
                500
            );
            
            // The malicious contract should not be able to re-enter
            await expect(
                maliciousEndorser.attemptReentrancy(0)
            ).to.be.revertedWith("ReentrancyGuard: reentrant call");
        });

        it("Should prevent reentrancy in marketplace purchases", async function () {
            // Setup: List an NFT
            await carbonNFT.connect(user1).approve(marketplace.address, 0);
            await marketplace.connect(user1).listNFT(0, ethers.utils.parseEther("0.1"));
            
            // Create malicious buyer contract
            const MaliciousBuyer = await ethers.getContractFactory("MaliciousBuyer");
            const maliciousBuyer = await MaliciousBuyer.deploy(marketplace.address);
            await maliciousBuyer.deployed();
            
            // Fund the malicious buyer
            await owner.sendTransaction({
                to: maliciousBuyer.address,
                value: ethers.utils.parseEther("1")
            });
            
            // Attempt reentrancy attack should fail
            await expect(
                maliciousBuyer.attemptReentrancy(1, { value: ethers.utils.parseEther("0.1") })
            ).to.be.revertedWith("ReentrancyGuard: reentrant call");
        });
    });

    describe("Integer Overflow/Underflow Tests", function () {
        it("Should handle score overflow in endorsements", async function () {
            // Mint NFT with maximum score
            await carbonNFT.mintCarbonNFT(user2.address, "max-uri", "max-theme", Grade.A, 9990);
            
            // Multiple endorsements should cap at 10000, not overflow
            for (let i = 0; i < 5; i++) {
                const newUser = ethers.Wallet.createRandom().connect(ethers.provider);
                await owner.sendTransaction({
                    to: newUser.address,
                    value: ethers.utils.parseEther("1")
                });
                await carbonNFT.connect(newUser).registerUser(UserType.Individual);
                await carbonNFT.mintCarbonNFT(newUser.address, `uri-${i}`, `theme-${i}`, Grade.C, 500);
                await carbonNFT.connect(newUser).endorseNFT(1);
            }
            
            const nftData = await carbonNFT.getNFTData(1);
            expect(nftData.carbonScore).to.equal(10000); // Should be capped, not overflowed
        });

        it("Should handle large vote counts in governance", async function () {
            // Create proposal
            await governance.connect(user1).createProposal(
                "Test proposal",
                0,
                ethers.utils.defaultAbiCoder.encode(["uint256"], [300])
            );
            
            // Vote with user who has NFTs
            await governance.connect(user1).vote(0, true);
            
            const proposal = await governance.getProposal(0);
            expect(proposal.votesFor).to.be.gte(1);
            expect(proposal.votesAgainst).to.equal(0);
        });
    });

    describe("Business Logic Security Tests", function () {
        it("Should prevent double registration", async function () {
            await expect(
                carbonNFT.connect(user1).registerUser(UserType.Company)
            ).to.be.revertedWithCustomError(carbonNFT, "UserAlreadyRegistered");
        });

        it("Should prevent self-endorsement", async function () {
            await expect(
                carbonNFT.connect(user1).endorseNFT(0)
            ).to.be.revertedWithCustomError(carbonNFT, "SelfEndorsementNotAllowed");
        });

        it("Should prevent double endorsement", async function () {
            await carbonNFT.connect(user2).endorseNFT(0);
            
            await expect(
                carbonNFT.connect(user2).endorseNFT(0)
            ).to.be.revertedWithCustomError(carbonNFT, "AlreadyEndorsed");
        });

        it("Should prevent listing non-owned NFTs", async function () {
            await expect(
                marketplace.connect(user2).listNFT(0, ethers.utils.parseEther("0.1"))
            ).to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
        });

        it("Should prevent double voting in governance", async function () {
            await governance.connect(user1).createProposal(
                "Test proposal",
                0,
                ethers.utils.defaultAbiCoder.encode(["uint256"], [300])
            );
            
            await governance.connect(user1).vote(0, true);
            
            await expect(
                governance.connect(user1).vote(0, false)
            ).to.be.revertedWithCustomError(governance, "AlreadyVoted");
        });

        it("Should enforce weekly upload limits", async function () {
            // First update should work
            await carbonNFT.updateGrade(0, Grade.B, 700, "new-uri-1");
            
            // Second update in same week should fail
            await expect(
                carbonNFT.updateGrade(0, Grade.A, 900, "new-uri-2")
            ).to.be.revertedWithCustomError(carbonNFT, "WeeklyLimitExceeded");
        });
    });

    describe("Gas Limit and DoS Protection Tests", function () {
        it("Should handle large pagination requests gracefully", async function () {
            // This should not run out of gas or cause DoS
            const result = await community.getPublicNFTs(0, 100);
            expect(result).to.be.an('array');
        });

        it("Should handle empty results in leaderboard", async function () {
            const leaderboard = await community.getLeaderboard(10);
            expect(leaderboard).to.be.an('array');
        });

        it("Should limit proposal description length", async function () {
            const longDescription = "a".repeat(1001); // Exceeds 1000 character limit
            
            await expect(
                governance.connect(user1).createProposal(
                    longDescription,
                    0,
                    ethers.utils.defaultAbiCoder.encode(["uint256"], [300])
                )
            ).to.be.revertedWithCustomError(governance, "InvalidProposal");
        });
    });

    describe("External Call Safety Tests", function () {
        it("Should handle failed external calls gracefully in Community", async function () {
            // This tests the try-catch blocks in Community contract
            // The actual implementation should handle cases where CarbonNFT calls fail
            const publicNFTs = await community.getPublicNFTs(0, 10);
            expect(publicNFTs).to.be.an('array');
        });

        it("Should handle failed token ownership checks in Marketplace", async function () {
            // Test that marketplace handles cases where ownerOf might fail
            await expect(
                marketplace.getSuggestedPrice(999) // Non-existent token
            ).to.be.revertedWithCustomError(marketplace, "TokenNotFound");
        });
    });
});

// Helper contracts for testing reentrancy attacks
contract MaliciousEndorser {
    CarbonNFT public carbonNFT;
    bool public attacking = false;
    
    constructor(address _carbonNFT) {
        carbonNFT = CarbonNFT(_carbonNFT);
    }
    
    function attemptReentrancy(uint256 tokenId) external {
        attacking = true;
        carbonNFT.endorseNFT(tokenId);
    }
    
    // This would be called during the endorsement process if reentrancy was possible
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        if (attacking) {
            // Try to re-enter the endorseNFT function
            carbonNFT.endorseNFT(0);
        }
        return this.onERC721Received.selector;
    }
}

contract MaliciousBuyer {
    Marketplace public marketplace;
    bool public attacking = false;
    
    constructor(address _marketplace) {
        marketplace = Marketplace(_marketplace);
    }
    
    function attemptReentrancy(uint256 listingId) external payable {
        attacking = true;
        marketplace.buyNFT{value: msg.value}(listingId);
    }
    
    // This would be called during the purchase process if reentrancy was possible
    receive() external payable {
        if (attacking && address(marketplace).balance > 0) {
            // Try to re-enter the buyNFT function
            marketplace.buyNFT{value: 0.1 ether}(1);
        }
    }
    
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        return this.onERC721Received.selector;
    }
}