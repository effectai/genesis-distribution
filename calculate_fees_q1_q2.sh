#!/usr/bin/env bb

(def eos-endpoint "https://eos.greymass.com/")

;; this is 10% of the Effect Force payouts from `force_payout_per_cycle.csv`
(def cycle->fee
  {"1" 850.726660000
   "2" 936.742280000
   "3" 12009.139030000
   "4" 11843.030000000
   "5" 19533.548000000
   "6" 11463.058000000
   "7" 9097.494000000
   "8" 17000.558000000
   "9" 12042.370000000
   "10" 2388.830000000
   "11" 2648.380000000
   "12" 3387.987000000
   "13" 2001.420000000})

(defn get-table-rows [account table scope opts]
  (-> (curl/post (str eos-endpoint "v1/chain/get_table_rows")
                 {:body (json/generate-string
                         (merge
                          {"code" account "table" table "scope" scope "json" true}
                          opts))})
      :body
      (json/decode true)))

(defn get-all-table-rows [account table scope]
  (loop [all-rows (list)
         offset 0]
    (let [batch-size 100
          {:keys [more rows]}
          (get-table-rows account table scope {"lower_bound" offset "limit" batch-size})]
      (if more
        (recur (concat all-rows rows) (+ offset batch-size))
        (concat all-rows rows)))))

(defn create-cycle-dates-csv!
  "Create a CSV of cycle start and end dates (see `cycle_dates.csv`)"
  []
  (let [cycles (get-all-table-rows "daoproposals" "cycle" "daoproposals")
        dates
        (->> (map (fn [a b] [(:id a) (:start_time a) (:start_time b)]) (butlast cycles) (rest cycles))
             rest)]
    (with-open [writer (io/writer "cycle_dates.csv")]
      (csv/write-csv writer dates))))

(def get-proposal-cycle
  (memoize
   (fn [id]
     (let [prop (get-table-rows "daoproposals" "proposal" "daoproposals"
                                {"lower_bound" id "upper_bound" id "limit" 1})]
       (-> prop :rows first :cycle)))))

(def get-cycle-total-weight
  (memoize
   (fn [id]
     (let [cycle (get-table-rows "daoproposals" "cycle" "daoproposals"
                                 {"lower_bound" id "upper_bound" id "limit" 1})]
       (-> cycle :rows first :total_vote_weight)))))

(defn create-voteweight-csv [filename max-cycle]
  (let [csv-header ["voter" "proposal" "weight" "cycle"]
        all-rows (->> (get-all-table-rows "daoproposals" "vote" "daoproposals")
                      (map #(select-keys % [:voter :proposal_id :weight]))
                      (map vals)
                      (map (fn [[v p w]] (vec [v p w (get-proposal-cycle p)])))
                      (filter #(<= (last %) max-cycle)))
        _ (prn "LOADED " (count all-rows) "votes")]
    (doall
     (for [[voter proposal weight] all-rows]
       (get-proposal-cycle proposal)))
    (with-open [writer (io/writer filename)]
      (csv/write-csv writer (concat [csv-header] all-rows)))
    all-rows))

(defn csv-data->maps [csv-data]
  (map zipmap
       (->> (first csv-data)
            (map keyword)
            repeat)
       (rest csv-data)))

(defn load-voteweight-csv [filename]
  (with-open [reader (io/reader filename)]
    (doall (csv-data->maps (csv/read-csv reader)))))

(defn voteweight-per-cycle
  "aggregate voteweight per user per cycle"
  [rows]
  (->> rows
       (group-by (fn [row] [(:voter row) (:cycle row)]))
       (map (fn [[[user cycle] vals]]
              [user cycle (reduce + (map #(Integer/parseInt %) (map :weight vals)))]))
       (map (fn [[user cycle weight]] [user cycle weight
                                      (float (/ weight (get-cycle-total-weight cycle)))
                                      (float (* (/ weight (get-cycle-total-weight cycle))
                                                (get cycle->fee cycle)))]))))



;; Scrape the vote weights CVS from the blockchain. Can be commented out to load cached file.
;; (println "==> Creating voteweight CSV")
;; (create-voteweight-csv "q1_q2_voteweight_cycle13.csv" 13)
;; (println "Done!")

(let [rows (load-voteweight-csv "q1_q2_voteweight_cycle13.csv")
      vote-weights-per-cycle (voteweight-per-cycle rows)
      efx-reward-per-user (->> vote-weights-per-cycle
                               (group-by first)
                               (map (fn [[user vals]]
                                      [user (reduce + (map last vals))])))]
  (with-open [writer (io/writer "output.csv")]
    (csv/write-csv writer vote-weights-per-cycle))
  (with-open [writer (io/writer "q1_q2_airdop.csv")]
    (csv/write-csv writer efx-reward-per-user)))
