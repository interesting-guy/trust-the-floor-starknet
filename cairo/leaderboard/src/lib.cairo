#[starknet::interface]
pub trait ITrustTheFloor<TContractState> {
    fn submit_score(ref self: TContractState, deaths: felt252, level_reached: felt252);
    fn get_leaderboard(self: @TContractState) -> Array<(starknet::ContractAddress, felt252, felt252)>;
    fn get_player_score(self: @TContractState, address: starknet::ContractAddress) -> (felt252, felt252);
}

#[starknet::contract]
mod TrustTheFloor {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess,
        Vec, VecTrait, MutableVecTrait,
        Map, StorageMapReadAccess, StorageMapWriteAccess,
    };

    #[storage]
    struct Storage {
        players: Vec<ContractAddress>,
        deaths: Map<ContractAddress, felt252>,
        level_reached: Map<ContractAddress, felt252>,
        has_score: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ScoreSubmitted: ScoreSubmitted,
    }

    #[derive(Drop, starknet::Event)]
    struct ScoreSubmitted {
        #[key]
        player: ContractAddress,
        deaths: felt252,
        level_reached: felt252,
    }

    #[abi(embed_v0)]
    impl TrustTheFloorImpl of super::ITrustTheFloor<ContractState> {
        fn submit_score(ref self: ContractState, deaths: felt252, level_reached: felt252) {
            let caller = get_caller_address();
            let already_has = self.has_score.read(caller);
            if !already_has {
                self.players.push(caller);
                self.has_score.write(caller, true);
            }
            self.deaths.write(caller, deaths);
            self.level_reached.write(caller, level_reached);
            self.emit(ScoreSubmitted { player: caller, deaths, level_reached });
        }

        fn get_leaderboard(self: @ContractState) -> Array<(ContractAddress, felt252, felt252)> {
            let len = self.players.len();
            let mut result: Array<(ContractAddress, felt252, felt252)> = ArrayTrait::new();
            let mut i: u64 = 0;
            loop {
                if i >= len {
                    break;
                }
                let player = self.players.at(i).read();
                let d = self.deaths.read(player);
                let l = self.level_reached.read(player);
                result.append((player, d, l));
                i += 1;
            };
            result
        }

        fn get_player_score(self: @ContractState, address: ContractAddress) -> (felt252, felt252) {
            (self.deaths.read(address), self.level_reached.read(address))
        }
    }
}
