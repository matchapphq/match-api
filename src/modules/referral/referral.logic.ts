import referralRepository from "../../repository/referral.repository";

const REFERRAL_BASE_URL = process.env.REFERRAL_BASE_URL || 'https://match.app/register?ref=';

export class ReferralLogic {
    async getCode(userId: string) {
        let referralCode = await referralRepository.getReferralCode(userId);
        
        if (!referralCode) {
            referralCode = await referralRepository.createReferralCode(userId);
        }

        if (!referralCode) {
            throw new Error("FAILED_TO_CREATE_CODE");
        }

        return {
            referral_code: referralCode.referral_code,
            referral_link: `${REFERRAL_BASE_URL}${referralCode.referral_code}`,
            created_at: referralCode.created_at?.toISOString(),
        };
    }

    async getStats(userId: string) {
        return await referralRepository.getReferralStats(userId);
    }

    async getHistory(userId: string, page: number, limit: number, status: string) {
        return await referralRepository.getReferralHistory(userId, {
            page,
            limit,
            status,
        });
    }

    async validateCode(referralCode: string) {
        if (!/^MATCH-RESTO-[A-Z0-9]{6}$/.test(referralCode)) {
            return { 
                valid: false, 
                message: "Format de code invalide", 
            };
        }

        const validation = await referralRepository.validateReferralCode(referralCode);

        if (!validation.valid) {
            return { 
                valid: false, 
                message: "Code de parrainage invalide", 
            };
        }

        return {
            valid: true,
            referrer_name: validation.referrer_name,
            message: "Code de parrainage valide",
        };
    }

    async registerReferral(referralCode: string, referredUserId: string) {
        const result = await referralRepository.registerReferral(referralCode, referredUserId);

        if (!result.success) {
            throw new Error(result.error || "REGISTRATION_FAILED");
        }

        return {
            success: true,
            referral_id: result.referral_id,
            message: "Parrainage enregistré avec succès",
        };
    }

    async convertReferral(referredUserId: string) {
        const result = await referralRepository.convertReferral(referredUserId);

        if (!result.success) {
            throw new Error(result.error || "CONVERSION_FAILED");
        }

        return {
            success: true,
            referral_id: result.referral_id,
            boost_id: result.boost_id,
            referred_boost_id: result.referred_boost_id,
            referrer_id: result.referrer_id,
            message: "Parrainage converti, 1 boost ajoute a chaque compte",
        };
    }

    async getBoosts(userId: string) {
        const boosts = await referralRepository.getAvailableBoosts(userId);
        return { 
            boosts,
            total: boosts.length,
        };
    }

    async useBoost(userId: string, boostId: string, venueMatchId: string) {
        const result = await referralRepository.useBoost(boostId, userId, venueMatchId);

        if (!result.success) {
            throw new Error(result.error || "BOOST_USAGE_FAILED");
        }

        return {
            success: true,
            message: "Boost utilisé avec succès",
        };
    }
}
