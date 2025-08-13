import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("Libraries Tests", function () {
    let gradeUtilsTest: Contract;
    let validationUtilsTest: Contract;
    let pricingUtilsTest: Contract;
    let arrayUtilsTest: Contract;
    
    before(async function () {
        // Deploy test contracts that use the libraries
        const GradeUtilsTestFactory = await ethers.getContractFactory("GradeUtilsTest");
        gradeUtilsTest = await GradeUtilsTestFactory.deploy();
        await gradeUtilsTest.deployed();
        
        const ValidationUtilsTestFactory = await ethers.getContractFactory("ValidationUtilsTest");
        validationUtilsTest = await ValidationUtilsTestFactory.deploy();
        await validationUtilsTest.deployed();
        
        const PricingUtilsTestFactory = await ethers.getContractFactory("PricingUtilsTest");
        pricingUtilsTest = await PricingUtilsTestFactory.deploy();
        await pricingUtilsTest.deployed();
        
        const ArrayUtilsTestFactory = await ethers.getContractFactory("ArrayUtilsTest");
        arrayUtilsTest = await ArrayUtilsTestFactory.deploy();
        await arrayUtilsTest.deployed();
    });
    
    describe("GradeUtils Library", function () {
        it("Should convert scores to correct grades", async function () {
            expect(await gradeUtilsTest.testScoreToGrade(950)).to.equal(4); // Grade A
            expect(await gradeUtilsTest.testScoreToGrade(750)).to.equal(3); // Grade B
            expect(await gradeUtilsTest.testScoreToGrade(550)).to.equal(2); // Grade C
            expect(await gradeUtilsTest.testScoreToGrade(350)).to.equal(1); // Grade D
            expect(await gradeUtilsTest.testScoreToGrade(250)).to.equal(0); // Grade F
        });
        
        it("Should return correct grade multipliers", async function () {
            expect(await gradeUtilsTest.testGetGradeMultiplier(4)).to.equal(20000); // Grade A: 2.0x
            expect(await gradeUtilsTest.testGetGradeMultiplier(3)).to.equal(15000); // Grade B: 1.5x
            expect(await gradeUtilsTest.testGetGradeMultiplier(2)).to.equal(10000); // Grade C: 1.0x
            expect(await gradeUtilsTest.testGetGradeMultiplier(1)).to.equal(7500);  // Grade D: 0.75x
            expect(await gradeUtilsTest.testGetGradeMultiplier(0)).to.equal(5000);  // Grade F: 0.5x
        });
        
        it("Should calculate grade-based prices correctly", async function () {
            const basePrice = ethers.utils.parseEther("0.01");
            
            const priceA = await gradeUtilsTest.testCalculateGradeBasedPrice(basePrice, 4);
            expect(priceA).to.equal(ethers.utils.parseEther("0.02")); // 2x base price
            
            const priceC = await gradeUtilsTest.testCalculateGradeBasedPrice(basePrice, 2);
            expect(priceC).to.equal(basePrice); // 1x base price
            
            const priceF = await gradeUtilsTest.testCalculateGradeBasedPrice(basePrice, 0);
            expect(priceF).to.equal(ethers.utils.parseEther("0.005")); // 0.5x base price
        });
        
        it("Should convert grades to strings", async function () {
            expect(await gradeUtilsTest.testGradeToString(4)).to.equal("A");
            expect(await gradeUtilsTest.testGradeToString(3)).to.equal("B");
            expect(await gradeUtilsTest.testGradeToString(2)).to.equal("C");
            expect(await gradeUtilsTest.testGradeToString(1)).to.equal("D");
            expect(await gradeUtilsTest.testGradeToString(0)).to.equal("F");
        });
        
        it("Should validate grades correctly", async function () {
            expect(await gradeUtilsTest.testIsValidGrade(0)).to.be.true;
            expect(await gradeUtilsTest.testIsValidGrade(4)).to.be.true;
            expect(await gradeUtilsTest.testIsValidGrade(5)).to.be.false;
        });
    });
    
    describe("ValidationUtils Library", function () {
        it("Should validate addresses correctly", async function () {
            const validAddress = "0x1234567890123456789012345678901234567890";
            const zeroAddress = "0x0000000000000000000000000000000000000000";
            
            await expect(validationUtilsTest.testRequireValidAddress(validAddress)).to.not.be.reverted;
            await expect(validationUtilsTest.testRequireValidAddress(zeroAddress))
                .to.be.revertedWithCustomError(validationUtilsTest, "InvalidAddress");
        });
        
        it("Should validate amounts correctly", async function () {
            await expect(validationUtilsTest.testRequirePositiveAmount(100)).to.not.be.reverted;
            await expect(validationUtilsTest.testRequirePositiveAmount(0))
                .to.be.revertedWithCustomError(validationUtilsTest, "InvalidAmount");
        });
        
        it("Should validate amount ranges correctly", async function () {
            await expect(validationUtilsTest.testRequireAmountInRange(50, 10, 100)).to.not.be.reverted;
            await expect(validationUtilsTest.testRequireAmountInRange(5, 10, 100))
                .to.be.revertedWithCustomError(validationUtilsTest, "InvalidAmount");
            await expect(validationUtilsTest.testRequireAmountInRange(150, 10, 100))
                .to.be.revertedWithCustomError(validationUtilsTest, "InvalidAmount");
        });
        
        it("Should validate percentages correctly", async function () {
            await expect(validationUtilsTest.testRequireValidPercentage(5000)).to.not.be.reverted; // 50%
            await expect(validationUtilsTest.testRequireValidPercentage(10000)).to.not.be.reverted; // 100%
            await expect(validationUtilsTest.testRequireValidPercentage(15000))
                .to.be.revertedWithCustomError(validationUtilsTest, "InvalidPercentage");
        });
        
        it("Should validate strings correctly", async function () {
            await expect(validationUtilsTest.testRequireNonEmptyString("test")).to.not.be.reverted;
            await expect(validationUtilsTest.testRequireNonEmptyString(""))
                .to.be.revertedWithCustomError(validationUtilsTest, "InvalidString");
        });
        
        it("Should calculate percentages correctly", async function () {
            expect(await validationUtilsTest.testCalculatePercentage(1000, 2500)).to.equal(250); // 25% of 1000
            expect(await validationUtilsTest.testCalculatePercentage(1000, 10000)).to.equal(1000); // 100% of 1000
        });
        
        it("Should perform safe division", async function () {
            expect(await validationUtilsTest.testSafeDivision(100, 10)).to.equal(10);
            expect(await validationUtilsTest.testSafeDivision(100, 0)).to.equal(0); // Safe division by zero
        });
    });
    
    describe("PricingUtils Library", function () {
        it("Should calculate fees correctly", async function () {
            const price = ethers.utils.parseEther("1.0");
            const marketplaceFee = 250; // 2.5%
            const royalty = 500; // 5%
            
            const [calculatedMarketplaceFee, calculatedRoyalty, sellerAmount] = 
                await pricingUtilsTest.testCalculateFees(price, marketplaceFee, royalty);
            
            expect(calculatedMarketplaceFee).to.equal(ethers.utils.parseEther("0.025")); // 2.5%
            expect(calculatedRoyalty).to.equal(ethers.utils.parseEther("0.05")); // 5%
            expect(sellerAmount).to.equal(ethers.utils.parseEther("0.925")); // 92.5%
        });
        
        it("Should calculate endorsement bonus correctly", async function () {
            expect(await pricingUtilsTest.testCalculateEndorsementBonus(0)).to.equal(0);
            expect(await pricingUtilsTest.testCalculateEndorsementBonus(10)).to.equal(1000); // 10% bonus
            expect(await pricingUtilsTest.testCalculateEndorsementBonus(100)).to.equal(5000); // Capped at 50%
        });
        
        it("Should calculate theme multipliers correctly", async function () {
            expect(await pricingUtilsTest.testCalculateThemeMultiplier("renewable-energy")).to.equal(1500);
            expect(await pricingUtilsTest.testCalculateThemeMultiplier("carbon-neutral")).to.equal(1200);
            expect(await pricingUtilsTest.testCalculateThemeMultiplier("sustainability")).to.equal(1000);
            expect(await pricingUtilsTest.testCalculateThemeMultiplier("eco-friendly")).to.equal(800);
            expect(await pricingUtilsTest.testCalculateThemeMultiplier("other-theme")).to.equal(0);
        });
        
        it("Should calculate price ranges correctly", async function () {
            const suggestedPrice = ethers.utils.parseEther("1.0");
            const volatility = 2000; // 20%
            
            const [minPrice, maxPrice] = await pricingUtilsTest.testCalculatePriceRange(suggestedPrice, volatility);
            
            expect(minPrice).to.equal(ethers.utils.parseEther("0.8")); // -20%
            expect(maxPrice).to.equal(ethers.utils.parseEther("1.2")); // +20%
        });
        
        it("Should validate price reasonableness", async function () {
            const suggestedPrice = ethers.utils.parseEther("1.0");
            const maxDeviation = 2000; // 20%
            
            expect(await pricingUtilsTest.testIsPriceReasonable(
                ethers.utils.parseEther("1.1"), suggestedPrice, maxDeviation
            )).to.be.true; // 10% deviation is acceptable
            
            expect(await pricingUtilsTest.testIsPriceReasonable(
                ethers.utils.parseEther("1.3"), suggestedPrice, maxDeviation
            )).to.be.false; // 30% deviation is too much
        });
        
        it("Should calculate bulk discounts correctly", async function () {
            const totalPrice = ethers.utils.parseEther("10.0");
            
            expect(await pricingUtilsTest.testCalculateBulkDiscount(totalPrice, 1))
                .to.equal(totalPrice); // No discount for single item
            
            expect(await pricingUtilsTest.testCalculateBulkDiscount(totalPrice, 3))
                .to.equal(ethers.utils.parseEther("9.8")); // 2% discount for 2-4 items
            
            expect(await pricingUtilsTest.testCalculateBulkDiscount(totalPrice, 7))
                .to.equal(ethers.utils.parseEther("9.5")); // 5% discount for 5-9 items
            
            expect(await pricingUtilsTest.testCalculateBulkDiscount(totalPrice, 15))
                .to.equal(ethers.utils.parseEther("9.0")); // 10% discount for 10+ items
        });
    });
    
    describe("ArrayUtils Library", function () {
        it("Should check array containment correctly", async function () {
            const testArray = [1, 2, 3, 4, 5];
            
            expect(await arrayUtilsTest.testContainsUint256(testArray, 3)).to.be.true;
            expect(await arrayUtilsTest.testContainsUint256(testArray, 10)).to.be.false;
        });
        
        it("Should remove elements from arrays correctly", async function () {
            const testArray = [1, 2, 3, 4, 5];
            const result = await arrayUtilsTest.testRemoveUint256(testArray, 3);
            
            expect(result).to.deep.equal([1, 2, 4, 5]);
        });
        
        it("Should find unique elements correctly", async function () {
            const testArray = [1, 2, 2, 3, 3, 3, 4];
            const result = await arrayUtilsTest.testUniqueUint256(testArray);
            
            expect(result).to.deep.equal([1, 2, 3, 4]);
        });
        
        it("Should sort arrays correctly", async function () {
            const testArray = [5, 2, 8, 1, 9];
            
            const ascending = await arrayUtilsTest.testSortUint256Ascending(testArray);
            expect(ascending).to.deep.equal([1, 2, 5, 8, 9]);
            
            const descending = await arrayUtilsTest.testSortUint256Descending(testArray);
            expect(descending).to.deep.equal([9, 8, 5, 2, 1]);
        });
        
        it("Should slice arrays correctly", async function () {
            const testArray = [1, 2, 3, 4, 5];
            const result = await arrayUtilsTest.testSliceUint256(testArray, 1, 4);
            
            expect(result).to.deep.equal([2, 3, 4]);
        });
        
        it("Should concatenate arrays correctly", async function () {
            const array1 = [1, 2, 3];
            const array2 = [4, 5, 6];
            const result = await arrayUtilsTest.testConcatUint256(array1, array2);
            
            expect(result).to.deep.equal([1, 2, 3, 4, 5, 6]);
        });
        
        it("Should find min/max values correctly", async function () {
            const testArray = [5, 2, 8, 1, 9];
            
            expect(await arrayUtilsTest.testMaxUint256(testArray)).to.equal(9);
            expect(await arrayUtilsTest.testMinUint256(testArray)).to.equal(1);
        });
        
        it("Should calculate sum correctly", async function () {
            const testArray = [1, 2, 3, 4, 5];
            expect(await arrayUtilsTest.testSumUint256(testArray)).to.equal(15);
        });
    });
});